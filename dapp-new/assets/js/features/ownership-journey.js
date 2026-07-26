import { initWalletAllocation } from './wallet-allocation.js';

/**
 * Homepage ownership journey.
 *
 * Two independent enhancements live here:
 * 1. scroll-driven assembly of the wallet / dashboard / vault composition;
 * 2. an accessible Base / Pro / Advanced illustrative vault selector.
 *
 * The document remains readable without JavaScript. Motion is disabled on
 * compact layouts and when the visitor requests reduced motion.
 */
const journey = document.querySelector('[data-ownership-journey]');
initWalletAllocation();

if (journey) {
  const source = document.querySelector('[data-ownership-source]');
  const dashboard = journey.querySelector('[data-ownership-dashboard]');
  const walletSide = journey.querySelector('[data-ownership-side="wallet"]');
  const vaultSide = journey.querySelector('[data-ownership-side="vaults"]');
  const stageWrap = journey.querySelector('.ownership-stage-wrap');
  const stage = journey.querySelector('.ownership-stage');
  const walletPreview = walletSide?.querySelector('.ownership-wallet-preview');
  const vaultPreview = vaultSide?.querySelector('.ownership-vault-preview');
  const walletBridge = walletPreview?.querySelector('.ownership-bridge--out');
  const vaultBridge = vaultPreview?.querySelector('.ownership-bridge--in');
  const walletTarget = dashboard?.querySelector('.balance-card--wallet');
  const vaultTarget = dashboard?.querySelector('.balance-card--vault');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactLayout = window.matchMedia('(max-width: 1150px)');
  let animationFrame = 0;

  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const ease = (value) => 1 - ((1 - value) ** 3);

  /**
   * Aim each connector at the corresponding balance card. Measurements keep
   * the line correct when the three panels or their transforms change size.
   */
  function positionBridge(bridge, preview, target, direction) {
    if (!bridge || !preview || !target || compactLayout.matches) return;
    const previewRect = preview.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scaleX = preview.offsetWidth ? previewRect.width / preview.offsetWidth : 1;
    const scaleY = preview.offsetHeight ? previewRect.height / preview.offsetHeight : 1;
    const viewportDistance = direction === 'out'
      ? targetRect.left - previewRect.right
      : previewRect.left - targetRect.right;
    const localDistance = Math.max(0, viewportDistance / Math.max(scaleX, .01));
    const localTop = (targetRect.top + targetRect.height / 2 - previewRect.top) / Math.max(scaleY, .01);
    bridge.style.setProperty('--bridge-length', `${localDistance + 2}px`);
    bridge.style.setProperty('--bridge-top', `${localTop}px`);
  }

  function updateBridgeGeometry() {
    positionBridge(walletBridge, walletPreview, walletTarget, 'out');
    positionBridge(vaultBridge, vaultPreview, vaultTarget, 'in');
  }

  function bindLinkedFocus(sidePanel, balanceCard) {
    if (!sidePanel || !balanceCard) return;
    const activate = () => {
      sidePanel.classList.add('is-linked-focus');
      balanceCard.classList.add('is-linked-focus');
    };
    const deactivate = () => {
      sidePanel.classList.remove('is-linked-focus');
      balanceCard.classList.remove('is-linked-focus');
    };
    for (const node of [sidePanel, balanceCard]) {
      node.addEventListener('pointerenter', activate);
      node.addEventListener('pointerleave', deactivate);
      node.addEventListener('focusin', activate);
      node.addEventListener('focusout', () => {
        window.setTimeout(() => {
          if (!sidePanel.matches(':focus-within') && !balanceCard.matches(':focus-within')) deactivate();
        }, 0);
      });
    }
  }

  bindLinkedFocus(walletSide, walletTarget);
  bindLinkedFocus(vaultSide, vaultTarget);

  const boundarySteps = journey.querySelector('.boundary-steps');
  let boundaryReplayTimer = 0;
  function playBoundaryPath() {
    window.clearTimeout(boundaryReplayTimer);
    boundarySteps?.classList.remove('is-replaying');
    // Restart reliably if this function is reused by another control later.
    void boundarySteps?.offsetWidth;
    boundarySteps?.classList.add('is-replaying');
    boundaryReplayTimer = window.setTimeout(() => {
      boundarySteps?.classList.remove('is-replaying');
    }, 3800);
  }
  if (boundarySteps && 'IntersectionObserver' in window) {
    const boundaryObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      playBoundaryPath();
      boundaryObserver.disconnect();
    }, { threshold: .35 });
    boundaryObserver.observe(boundarySteps);
  }

  function clearMotion() {
    for (const node of [source, dashboard, walletSide, vaultSide]) {
      if (!node) continue;
      node.style.removeProperty('transform');
      node.style.removeProperty('opacity');
      node.style.removeProperty('filter');
      node.style.removeProperty('visibility');
    }
    walletBridge?.style.removeProperty('opacity');
    vaultBridge?.style.removeProperty('opacity');
  }

  function updateMotion() {
    animationFrame = 0;
    if (reduceMotion.matches || compactLayout.matches || !source || !dashboard || !stageWrap) {
      clearMotion();
      updateBridgeGeometry();
      return;
    }

    const viewportHeight = window.innerHeight;
    const hero = source.closest('.hero');
    const heroStart = hero?.offsetTop ?? 0;
    const stageRect = stageWrap.getBoundingClientRect();
    const stageDocumentTop = stageRect.top + window.scrollY;
    const travelStart = heroStart + (hero?.offsetHeight ?? viewportHeight) * .12;
    const travelEnd = Math.max(travelStart + viewportHeight, stageDocumentTop - Math.max(72, viewportHeight * .07));
    const travelSpan = Math.max(1, travelEnd - travelStart);
    const travelProgress = clamp((window.scrollY - travelStart) / travelSpan);
    const shrinkEnd = .72;
    const shrinkProgress = clamp(travelProgress / shrinkEnd);
    const returnProgress = ease(clamp((travelProgress - shrinkEnd) / (1 - shrinkEnd)));

    // offsetTop/offsetLeft ignore transforms, which gives us stable centers for
    // the travelling source and its final dashboard destination.
    let sourceDocumentLeft = 0;
    let sourceDocumentTop = 0;
    for (let node = source; node; node = node.offsetParent) {
      sourceDocumentLeft += node.offsetLeft;
      sourceDocumentTop += node.offsetTop;
    }
    const sourceWidth = source.offsetWidth;
    const sourceHeight = source.offsetHeight;
    const sourceViewportCenterX = sourceDocumentLeft + sourceWidth / 2;
    const sourceViewportCenterY = sourceDocumentTop - window.scrollY + sourceHeight / 2;
    const naturalStageRect = stage?.getBoundingClientRect();
    const targetCenterX = (naturalStageRect?.left ?? 0) + dashboard.offsetLeft + dashboard.offsetWidth / 2;
    const targetCenterY = (naturalStageRect?.top ?? 0) + dashboard.offsetTop + dashboard.offsetHeight / 2;
    const requiredX = targetCenterX - sourceViewportCenterX;
    const requiredY = targetCenterY - sourceViewportCenterY;

    // While shrinking, translation almost compensates normal page scrolling:
    // the card therefore descends slowly instead of dropping a full viewport.
    const scrollTravel = Math.max(0, window.scrollY - travelStart);
    const slowDescentY = scrollTravel * 1.08;
    const transitionScroll = travelSpan * shrinkEnd;
    const transitionY = transitionScroll * 1.08;
    const translateY = travelProgress <= shrinkEnd
      ? slowDescentY
      : transitionY + (requiredY - transitionY) * returnProgress;
    const translateX = travelProgress <= shrinkEnd
      ? requiredX * .45 * ease(shrinkProgress)
      : requiredX * (.45 + .55 * returnProgress);

    const targetScale = dashboard.offsetWidth / Math.max(1, sourceWidth);
    const sourceScale = travelProgress <= shrinkEnd
      ? 1 - .55 * shrinkProgress
      : .45 + (targetScale - .45) * returnProgress;
    const dimmedOpacity = 1 - .76 * shrinkProgress;
    const restoredOpacity = .24 + .76 * returnProgress;
    const sourceOpacity = travelProgress <= shrinkEnd ? dimmedOpacity : restoredOpacity;
    const rotation = travelProgress * 360;

    source.style.transform = `perspective(1200px) translate3d(${translateX}px,${translateY}px,0) scale(${sourceScale}) rotateY(${rotation}deg)`;
    source.style.opacity = String(sourceOpacity);
    source.style.filter = `blur(${Math.sin(travelProgress * Math.PI) * 1.1}px)`;
    source.style.visibility = travelProgress >= 1 ? 'hidden' : 'visible';

    // The destination copy grows out of the travelling card during the final
    // part of the same trajectory; side panels arrive in the same interval.
    const dashboardAssembly = returnProgress;
    const sideAssembly = dashboardAssembly;
    dashboard.style.transform = `perspective(1200px) translateY(${(1 - dashboardAssembly) * -110}px) scale(${.45 + dashboardAssembly * .55}) rotateY(${(1 - dashboardAssembly) * -88}deg)`;
    // Only one dashboard is visible. The travelling original remains on screen
    // until it perfectly matches this destination, then the DOM copies swap.
    dashboard.style.opacity = travelProgress >= .999 ? '1' : '0';
    walletSide.style.transform = `translateX(${(1 - sideAssembly) * -150}px) scale(${.35 + sideAssembly * .65})`;
    vaultSide.style.transform = `translateX(${(1 - sideAssembly) * 150}px) scale(${.35 + sideAssembly * .65})`;
    walletSide.style.opacity = String(.08 + sideAssembly * .92);
    vaultSide.style.opacity = String(.08 + sideAssembly * .92);
    const bridgeOpacity = ease(clamp((returnProgress - .82) / .18));
    if (walletBridge) walletBridge.style.opacity = String(bridgeOpacity);
    if (vaultBridge) vaultBridge.style.opacity = String(bridgeOpacity);
    updateBridgeGeometry();
  }

  function requestMotionUpdate() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(updateMotion);
  }

  window.addEventListener('scroll', requestMotionUpdate, { passive: true });
  window.addEventListener('resize', requestMotionUpdate, { passive: true });
  reduceMotion.addEventListener('change', requestMotionUpdate);
  compactLayout.addEventListener('change', requestMotionUpdate);
  document.fonts?.ready.then(requestMotionUpdate);
  requestMotionUpdate();

  const modeCopy = {
    base: 'Choose how much to invest and the level of risk that feels right. Jethos keeps network and asset details out of the way.',
    pro: 'Choose the amount, your risk level and the network you want to use.',
    advanced: 'Choose the amount, risk, network and asset. Every option stays visible before you confirm.',
  };
  const baseVaults = [
    { key: 'conservative', name: 'Conservative', detail: 'More liquidity, fewer moving parts', apy: 3.2, allocations: [{ label: 'Liquid reserve', percent: 50, apy: 0 }, { label: 'Diversified lending', percent: 35, apy: 4.9 }, { label: 'Short-duration routes', percent: 15, apy: 3.8 }] },
    { key: 'balanced', name: 'Balanced', detail: 'A balance between growth and flexibility', apy: 5.1, allocations: [{ label: 'Liquid reserve', percent: 25, apy: 0 }, { label: 'Diversified lending', percent: 45, apy: 5.4 }, { label: 'Liquidity routes', percent: 30, apy: 6.2 }] },
    { key: 'opportunity', name: 'Opportunity', detail: 'More ways to earn, with more risk', apy: 7.8, allocations: [{ label: 'Liquid reserve', percent: 10, apy: 0 }, { label: 'Lending routes', percent: 40, apy: 7.2 }, { label: 'Opportunity routes', percent: 50, apy: 10.4 }] },
  ];
  const allocationColors = ['#8b5cf6', '#38bdf8', '#2dd4bf'];
  const chainLabels = { plasma: 'Plasma', ethereum: 'Ethereum', arbitrum: 'Arbitrum', base: 'Base', bnb: 'BNB Chain' };
  const tokenLabels = { usdc: 'USDC', usdt: 'USDT', btc: 'BTC', eth: 'ETH' };
  const chainAdjustments = { plasma: .6, ethereum: -.2, arbitrum: .4, base: .2, bnb: .5 };
  const tokenAdjustments = { usdc: 0, usdt: .15, btc: 1.1, eth: .8 };
  let selectedMode = 'base';
  let selectedChain = 'plasma';
  let selectedToken = 'usdc';

  const modeTabs = [...journey.querySelectorAll('[data-vault-mode]')];
  const chainButtons = [...journey.querySelectorAll('[data-chain]')];
  const tokenButtons = [...journey.querySelectorAll('[data-token]')];
  const chainFilter = journey.querySelector('[data-chain-filter]');
  const tokenFilter = journey.querySelector('[data-token-filter]');
  const copyTarget = journey.querySelector('[data-vault-mode-copy]');
  const popover = journey.querySelector('[data-vault-popover]');
  const popoverTitle = journey.querySelector('[data-vault-popover-title]');
  const popoverSummary = journey.querySelector('[data-vault-popover-summary]');
  const popoverAllocations = journey.querySelector('[data-vault-popover-allocations]');
  const popoverSlices = journey.querySelector('[data-vault-popover-slices]');
  const popoverChartValue = journey.querySelector('[data-vault-chart-value]');
  const popoverChartLabel = journey.querySelector('[data-vault-chart-label]');
  let selectedVaultKey = null;
  let popoverPinned = false;
  let vaultHoverTimer = null;

  function selectedContext() {
    if (selectedMode === 'base') return 'a simple managed route';
    if (selectedMode === 'pro') return `${chainLabels[selectedChain]} network`; 
    return `${chainLabels[selectedChain]} · ${tokenLabels[selectedToken]}`;
  }

  function scenarioAdjustment() {
    const modeAdjustment = selectedMode === 'base' ? 0 : selectedMode === 'pro' ? .7 : 1.2;
    const chainAdjustment = selectedMode === 'base' ? 0 : chainAdjustments[selectedChain];
    const tokenAdjustment = selectedMode === 'advanced' ? tokenAdjustments[selectedToken] : 0;
    return modeAdjustment + chainAdjustment + tokenAdjustment;
  }

  function positionVaultPopover() {
    if (!popover || popover.hidden || !selectedVaultKey) return;
    const activeRow = journey.querySelector(`[data-vault-option="${selectedVaultKey}"]`);
    if (!activeRow) return;
    const rowRect = activeRow.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const edge = 12;
    let left = rowRect.left - width - 16;
    if (left < edge) left = Math.min(window.innerWidth - width - edge, rowRect.right + 16);
    const top = Math.max(edge, Math.min(window.innerHeight - height - edge, rowRect.top + rowRect.height / 2 - height / 2));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function renderPopover() {
    if (!selectedVaultKey || !popover) return;
    const vault = baseVaults.find((candidate) => candidate.key === selectedVaultKey);
    if (!vault) return;
    popoverTitle.textContent = `${vault.name} · ${selectedContext()}`;
    popoverSummary.textContent = `Where this illustrative ${vault.name.toLowerCase()} vault would place its capital.`;
    popoverAllocations.replaceChildren();
    popoverSlices.replaceChildren();

    const allocationHead = document.createElement('div');
    allocationHead.className = 'ownership-allocation-head';
    allocationHead.setAttribute('aria-hidden', 'true');
    allocationHead.innerHTML = '<span></span><span>Share</span><span>APY</span>';
    popoverAllocations.append(allocationHead);

    const rows = [];
    const slices = [];
    let offset = 0;
    vault.allocations.forEach((allocation, index) => {
      const { label, percent } = allocation;
      const color = allocationColors[index % allocationColors.length];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ownership-allocation-row';
      row.dataset.allocationIndex = String(index);
      row.style.setProperty('--allocation-color', color);
      const name = document.createElement('span');
      const dot = document.createElement('i');
      name.append(dot, document.createTextNode(label));
      const value = document.createElement('strong');
      value.textContent = `${percent}%`;
      const apy = document.createElement('b');
      const adjustedApy = allocation.apy === 0 ? 0 : allocation.apy + scenarioAdjustment();
      apy.textContent = `${adjustedApy.toFixed(1)}%`;
      row.setAttribute('aria-label', `${label}: ${percent}% allocation, ${adjustedApy.toFixed(1)}% illustrative APY`);
      row.append(name, value, apy);
      popoverAllocations.append(row);
      rows.push(row);

      const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      slice.classList.add('ownership-allocation-slice');
      slice.dataset.allocationIndex = String(index);
      slice.setAttribute('cx', '60');
      slice.setAttribute('cy', '60');
      slice.setAttribute('r', '42');
      slice.setAttribute('pathLength', '100');
      slice.setAttribute('stroke-dasharray', `${percent} ${100 - percent}`);
      slice.setAttribute('stroke-dashoffset', String(-offset));
      slice.setAttribute('tabindex', '0');
      slice.setAttribute('role', 'button');
      slice.setAttribute('aria-label', `${label}: ${percent}% allocation`);
      slice.style.setProperty('--allocation-color', color);
      popoverSlices.append(slice);
      slices.push(slice);
      offset += percent;
    });

    function highlightAllocation(index = null) {
      rows.forEach((row, rowIndex) => row.classList.toggle('is-active', rowIndex === index));
      slices.forEach((slice, sliceIndex) => slice.classList.toggle('is-active', sliceIndex === index));
      if (index === null) {
        popoverChartValue.textContent = '100%';
        popoverChartLabel.textContent = 'allocated';
      } else {
        popoverChartValue.textContent = `${vault.allocations[index].percent}%`;
        popoverChartLabel.textContent = vault.allocations[index].label;
      }
    }

    [...rows, ...slices].forEach((control) => {
      const index = Number(control.dataset.allocationIndex);
      control.addEventListener('mouseenter', () => highlightAllocation(index));
      control.addEventListener('focus', () => highlightAllocation(index));
      control.addEventListener('mouseleave', () => {
        if (!popover.matches(':focus-within')) highlightAllocation();
      });
      control.addEventListener('blur', () => {
        window.setTimeout(() => {
          if (!popover.matches(':focus-within')) highlightAllocation();
        }, 0);
      });
    });

    if (!popover.classList.contains('is-portal')) {
      popover.classList.add('is-portal');
      document.body.append(popover);
    }
    popover.hidden = false;
    positionVaultPopover();
    journey.querySelectorAll('[data-vault-option]').forEach((row) => row.classList.toggle('is-active', row.dataset.vaultOption === selectedVaultKey));
  }

  function closePopover() {
    if (vaultHoverTimer) window.clearTimeout(vaultHoverTimer);
    vaultHoverTimer = null;
    selectedVaultKey = null;
    popoverPinned = false;
    if (popover) popover.hidden = true;
    journey.querySelectorAll('[data-vault-option]').forEach((row) => row.classList.remove('is-active'));
  }

  function renderVaultExperience() {
    modeTabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.vaultMode === selectedMode)));
    chainFilter.hidden = selectedMode === 'base';
    tokenFilter.hidden = selectedMode !== 'advanced';
    copyTarget.textContent = modeCopy[selectedMode];
    chainButtons.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.chain === selectedChain)));
    tokenButtons.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.token === selectedToken)));

    const adjustment = scenarioAdjustment();
    const context = selectedMode === 'base'
      ? 'Managed route'
      : `${chainLabels[selectedChain]}${selectedMode === 'advanced' ? ` · ${tokenLabels[selectedToken]}` : ''}`;

    baseVaults.forEach((vault, index) => {
      const row = journey.querySelector(`[data-vault-option="${vault.key}"]`);
      if (!row) return;
      row.querySelector('[data-vault-name]').textContent = selectedMode === 'base' ? vault.name : `${context} ${vault.name}`;
      row.querySelector('[data-vault-detail]').textContent = selectedMode === 'base'
        ? vault.detail
        : `${vault.detail} · ${chainLabels[selectedChain]}${selectedMode === 'advanced' ? ` · ${tokenLabels[selectedToken]}` : ''}`;
      // Fixed illustrative outputs react to the selected scenario but never
      // query a market or imply current product availability.
      const illustrativeApy = vault.apy + adjustment + index * (selectedMode === 'advanced' ? .25 : 0);
      row.querySelector('[data-vault-apy]').textContent = `${illustrativeApy.toFixed(1)}%`;
    });
    renderPopover();
  }

  modeTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      selectedMode = tab.dataset.vaultMode;
      renderVaultExperience();
    });
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? modeTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + modeTabs.length) % modeTabs.length;
      modeTabs[nextIndex].focus();
      modeTabs[nextIndex].click();
    });
  });
  chainButtons.forEach((control) => control.addEventListener('click', () => {
    selectedChain = control.dataset.chain;
    renderVaultExperience();
  }));
  tokenButtons.forEach((control) => control.addEventListener('click', () => {
    selectedToken = control.dataset.token;
    renderVaultExperience();
  }));
  journey.querySelectorAll('[data-vault-option]').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      if (popoverPinned) return;
      if (vaultHoverTimer) window.clearTimeout(vaultHoverTimer);
      vaultHoverTimer = window.setTimeout(() => {
        vaultHoverTimer = null;
        if (!row.matches(':hover') || popoverPinned) return;
        selectedVaultKey = row.dataset.vaultOption;
        renderPopover();
      }, 900);
    });
    row.addEventListener('pointerleave', () => {
      if (vaultHoverTimer) window.clearTimeout(vaultHoverTimer);
      vaultHoverTimer = null;
      if (!popoverPinned && selectedVaultKey === row.dataset.vaultOption) closePopover();
    });
    row.addEventListener('click', () => {
      if (vaultHoverTimer) window.clearTimeout(vaultHoverTimer);
      vaultHoverTimer = null;
      selectedVaultKey = row.dataset.vaultOption;
      popoverPinned = true;
      renderPopover();
    });
  });
  journey.querySelector('[data-vault-popover-close]')?.addEventListener('click', closePopover);
  document.addEventListener('click', (event) => {
    if (!popover || popover.hidden) return;
    if (popover.contains(event.target)) return;
    if (event.target.closest('[data-vault-option], [data-vault-mode], [data-chain], [data-token]')) return;
    closePopover();
  });
  window.addEventListener('resize', positionVaultPopover, { passive: true });
  window.addEventListener('scroll', positionVaultPopover, { passive: true });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePopover(); });
  renderVaultExperience();
}
