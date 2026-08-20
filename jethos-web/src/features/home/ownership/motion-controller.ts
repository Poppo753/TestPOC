import type { DisposableController } from '../../../core/disposable';

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));
const ease = (value: number) => 1 - (1 - value) ** 3;

export function mountOwnershipMotion(
  journey: HTMLElement,
  source: HTMLElement | null,
): DisposableController {
  const dashboard = journey.querySelector<HTMLElement>('[data-ownership-dashboard]');
  const walletSide = journey.querySelector<HTMLElement>('[data-ownership-side="wallet"]');
  const vaultSide = journey.querySelector<HTMLElement>('[data-ownership-side="vaults"]');
  const stageWrap = journey.querySelector<HTMLElement>('.ownership-stage-wrap');
  const stage = journey.querySelector<HTMLElement>('.ownership-stage');
  const walletPreview = walletSide?.querySelector<HTMLElement>('.ownership-wallet-preview');
  const vaultPreview = vaultSide?.querySelector<HTMLElement>('.ownership-vault-preview');
  const walletBridge = walletPreview?.querySelector<HTMLElement>('.ownership-bridge--out');
  const vaultBridge = vaultPreview?.querySelector<HTMLElement>('.ownership-bridge--in');
  const walletTarget = dashboard?.querySelector<HTMLElement>('.balance-card--wallet');
  const vaultTarget = dashboard?.querySelector<HTMLElement>('.balance-card--vault');
  const boundarySteps = journey.querySelector<HTMLElement>('.boundary-steps');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactLayout = window.matchMedia('(max-width: 1150px)');
  const events = new AbortController();
  const focusTimers = new Set<number>();
  let animationFrame = 0;
  let compactObserver: IntersectionObserver | undefined;
  let boundaryObserver: IntersectionObserver | undefined;
  let boundaryReplayTimer: number | undefined;

  if (!dashboard || !walletSide || !vaultSide || !stageWrap || !stage) {
    throw new Error('Ownership motion markup is incomplete.');
  }

  const positionBridge = (
    bridge: HTMLElement | null | undefined,
    preview: HTMLElement | null | undefined,
    target: HTMLElement | null | undefined,
    direction: 'out' | 'in',
  ) => {
    if (!bridge || !preview || !target || compactLayout.matches) return;
    const previewRect = preview.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scaleX = preview.offsetWidth ? previewRect.width / preview.offsetWidth : 1;
    const scaleY = preview.offsetHeight ? previewRect.height / preview.offsetHeight : 1;
    const viewportDistance =
      direction === 'out'
        ? targetRect.left - previewRect.right
        : previewRect.left - targetRect.right;
    const localDistance = Math.max(0, viewportDistance / Math.max(scaleX, 0.01));
    const localTop =
      (targetRect.top + targetRect.height / 2 - previewRect.top) / Math.max(scaleY, 0.01);
    bridge.style.setProperty('--bridge-length', `${localDistance + 2}px`);
    bridge.style.setProperty('--bridge-top', `${localTop}px`);
  };
  const updateBridgeGeometry = () => {
    positionBridge(walletBridge, walletPreview, walletTarget, 'out');
    positionBridge(vaultBridge, vaultPreview, vaultTarget, 'in');
  };
  const bindLinkedFocus = (sidePanel: HTMLElement, balanceCard?: HTMLElement | null) => {
    if (!balanceCard) return;
    const activate = () => {
      sidePanel.classList.add('is-linked-focus');
      balanceCard.classList.add('is-linked-focus');
    };
    const deactivate = () => {
      sidePanel.classList.remove('is-linked-focus');
      balanceCard.classList.remove('is-linked-focus');
    };
    for (const node of [sidePanel, balanceCard]) {
      node.addEventListener('pointerenter', activate, { signal: events.signal });
      node.addEventListener('pointerleave', deactivate, { signal: events.signal });
      node.addEventListener('focusin', activate, { signal: events.signal });
      node.addEventListener(
        'focusout',
        () => {
          const timer = window.setTimeout(() => {
            focusTimers.delete(timer);
            if (!sidePanel.matches(':focus-within') && !balanceCard.matches(':focus-within')) {
              deactivate();
            }
          });
          focusTimers.add(timer);
        },
        { signal: events.signal },
      );
    }
  };
  bindLinkedFocus(walletSide, walletTarget);
  bindLinkedFocus(vaultSide, vaultTarget);

  const syncCompactAssembly = () => {
    compactObserver?.disconnect();
    compactObserver = undefined;
    const enabled = compactLayout.matches && !reduceMotion.matches;
    stage.classList.toggle('is-compact-motion', enabled);
    if (!enabled) {
      stage.classList.remove('is-compact-assembled');
      return;
    }
    if (!('IntersectionObserver' in window)) {
      stage.classList.add('is-compact-assembled');
      return;
    }
    stage.classList.remove('is-compact-assembled');
    compactObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        stage.classList.add('is-compact-assembled');
        compactObserver?.disconnect();
        compactObserver = undefined;
      },
      { threshold: 0.08 },
    );
    compactObserver.observe(stage);
  };
  const playBoundaryPath = () => {
    if (boundaryReplayTimer !== undefined) window.clearTimeout(boundaryReplayTimer);
    boundarySteps?.classList.remove('is-replaying');
    void boundarySteps?.offsetWidth;
    boundarySteps?.classList.add('is-replaying');
    boundaryReplayTimer = window.setTimeout(() => {
      boundarySteps?.classList.remove('is-replaying');
      boundaryReplayTimer = undefined;
    }, 3800);
  };
  if (boundarySteps && 'IntersectionObserver' in window) {
    boundaryObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        playBoundaryPath();
        boundaryObserver?.disconnect();
      },
      { threshold: 0.35 },
    );
    boundaryObserver.observe(boundarySteps);
  }

  const clearMotion = () => {
    for (const node of [source, dashboard, walletSide, vaultSide]) {
      if (!node) continue;
      for (const property of ['transform', 'opacity', 'filter', 'visibility']) {
        node.style.removeProperty(property);
      }
    }
    walletBridge?.style.removeProperty('opacity');
    vaultBridge?.style.removeProperty('opacity');
  };
  const updateMotion = () => {
    animationFrame = 0;
    if (reduceMotion.matches || compactLayout.matches || !source) {
      clearMotion();
      updateBridgeGeometry();
      return;
    }
    const viewportHeight = window.innerHeight;
    const hero = source.closest<HTMLElement>('.hero');
    const heroStart = hero?.offsetTop ?? 0;
    const stageRect = stageWrap.getBoundingClientRect();
    const stageDocumentTop = stageRect.top + window.scrollY;
    const travelStart = heroStart + (hero?.offsetHeight ?? viewportHeight) * 0.12;
    const travelEnd = Math.max(
      travelStart + viewportHeight,
      stageDocumentTop - Math.max(72, viewportHeight * 0.07),
    );
    const travelSpan = Math.max(1, travelEnd - travelStart);
    const travelProgress = clamp((window.scrollY - travelStart) / travelSpan);
    const shrinkEnd = 0.72;
    const shrinkProgress = clamp(travelProgress / shrinkEnd);
    const returnProgress = ease(clamp((travelProgress - shrinkEnd) / (1 - shrinkEnd)));

    let sourceDocumentLeft = 0;
    let sourceDocumentTop = 0;
    for (
      let node: HTMLElement | null = source;
      node;
      node = node.offsetParent as HTMLElement | null
    ) {
      sourceDocumentLeft += node.offsetLeft;
      sourceDocumentTop += node.offsetTop;
    }
    const sourceWidth = source.offsetWidth;
    const sourceHeight = source.offsetHeight;
    const sourceCenterX = sourceDocumentLeft + sourceWidth / 2;
    const sourceCenterY = sourceDocumentTop - window.scrollY + sourceHeight / 2;
    const naturalStageRect = stage.getBoundingClientRect();
    const targetCenterX = naturalStageRect.left + dashboard.offsetLeft + dashboard.offsetWidth / 2;
    const targetCenterY = naturalStageRect.top + dashboard.offsetTop + dashboard.offsetHeight / 2;
    const requiredX = targetCenterX - sourceCenterX;
    const requiredY = targetCenterY - sourceCenterY;
    const scrollTravel = Math.max(0, window.scrollY - travelStart);
    const transitionY = travelSpan * shrinkEnd * 1.08;
    const translateY =
      travelProgress <= shrinkEnd
        ? scrollTravel * 1.08
        : transitionY + (requiredY - transitionY) * returnProgress;
    const translateX =
      travelProgress <= shrinkEnd
        ? requiredX * 0.45 * ease(shrinkProgress)
        : requiredX * (0.45 + 0.55 * returnProgress);
    const targetScale = dashboard.offsetWidth / Math.max(1, sourceWidth);
    const sourceScale =
      travelProgress <= shrinkEnd
        ? 1 - 0.55 * shrinkProgress
        : 0.45 + (targetScale - 0.45) * returnProgress;
    const sourceOpacity =
      travelProgress <= shrinkEnd ? 1 - 0.76 * shrinkProgress : 0.24 + 0.76 * returnProgress;

    source.style.transform = `perspective(1200px) translate3d(${translateX}px,${translateY}px,0) scale(${sourceScale}) rotateY(${travelProgress * 360}deg)`;
    source.style.opacity = String(sourceOpacity);
    source.style.filter = `blur(${Math.sin(travelProgress * Math.PI) * 1.1}px)`;
    source.style.visibility = travelProgress >= 1 ? 'hidden' : 'visible';
    dashboard.style.transform = `perspective(1200px) translateY(${(1 - returnProgress) * -110}px) scale(${0.45 + returnProgress * 0.55}) rotateY(${(1 - returnProgress) * -88}deg)`;
    dashboard.style.opacity = travelProgress >= 0.999 ? '1' : '0';
    walletSide.style.transform = `translateX(${(1 - returnProgress) * -150}px) scale(${0.35 + returnProgress * 0.65})`;
    vaultSide.style.transform = `translateX(${(1 - returnProgress) * 150}px) scale(${0.35 + returnProgress * 0.65})`;
    walletSide.style.opacity = String(0.08 + returnProgress * 0.92);
    vaultSide.style.opacity = String(0.08 + returnProgress * 0.92);
    const bridgeOpacity = ease(clamp((returnProgress - 0.82) / 0.18));
    if (walletBridge) walletBridge.style.opacity = String(bridgeOpacity);
    if (vaultBridge) vaultBridge.style.opacity = String(bridgeOpacity);
    updateBridgeGeometry();
  };
  const requestUpdate = () => {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(updateMotion);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true, signal: events.signal });
  window.addEventListener('resize', requestUpdate, { passive: true, signal: events.signal });
  reduceMotion.addEventListener('change', requestUpdate, { signal: events.signal });
  compactLayout.addEventListener('change', requestUpdate, { signal: events.signal });
  reduceMotion.addEventListener('change', syncCompactAssembly, { signal: events.signal });
  compactLayout.addEventListener('change', syncCompactAssembly, { signal: events.signal });
  void document.fonts?.ready.then(() => !events.signal.aborted && requestUpdate());
  syncCompactAssembly();
  requestUpdate();

  return {
    destroy() {
      events.abort();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      compactObserver?.disconnect();
      boundaryObserver?.disconnect();
      if (boundaryReplayTimer !== undefined) window.clearTimeout(boundaryReplayTimer);
      for (const timer of focusTimers) window.clearTimeout(timer);
      focusTimers.clear();
      boundarySteps?.classList.remove('is-replaying');
      stage.classList.remove('is-compact-motion', 'is-compact-assembled');
      clearMotion();
    },
  };
}
