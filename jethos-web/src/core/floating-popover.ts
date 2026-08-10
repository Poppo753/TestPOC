export interface FloatingPopoverPlacement {
  left: number;
  top: number;
  arrowLeft: number;
  below: boolean;
}

export function calculateFloatingPopoverPlacement(
  anchor: DOMRect,
  popover: { width: number; height: number },
  viewport: { width: number; padding?: number; margin?: number; minimumTop?: number },
): FloatingPopoverPlacement {
  const padding = viewport.padding ?? 12;
  const margin = viewport.margin ?? 12;
  const minimumTop = viewport.minimumTop ?? 84;
  const maximumLeft = Math.max(padding, viewport.width - popover.width - padding);
  const left = Math.min(
    maximumLeft,
    Math.max(padding, anchor.left + anchor.width / 2 - popover.width / 2),
  );
  const preferredTop = anchor.top - popover.height - margin;
  const below = preferredTop < minimumTop;
  const top = Math.max(padding, below ? anchor.bottom + margin : preferredTop);
  const arrowLeft = Math.min(
    popover.width - 22,
    Math.max(22, anchor.left + anchor.width / 2 - left),
  );
  return { left, top, arrowLeft, below };
}

export function positionFloatingPopover(popover: HTMLElement, anchor: Element): void {
  const placement = calculateFloatingPopoverPlacement(
    anchor.getBoundingClientRect(),
    { width: popover.offsetWidth, height: popover.offsetHeight },
    { width: window.innerWidth },
  );
  popover.style.left = `${placement.left}px`;
  popover.style.top = `${placement.top}px`;
  popover.style.setProperty('--popover-arrow-left', `${placement.arrowLeft}px`);
  popover.classList.toggle('is-below', placement.below);
}

export function calculateSidePopoverPlacement(
  anchor: DOMRect,
  popover: { width: number; height: number },
  viewport: { width: number; height: number; edge?: number; gap?: number },
): Pick<FloatingPopoverPlacement, 'left' | 'top'> {
  const edge = viewport.edge ?? 12;
  const gap = viewport.gap ?? 16;
  let left = anchor.left - popover.width - gap;
  if (left < edge) left = Math.min(viewport.width - popover.width - edge, anchor.right + gap);
  const top = Math.max(
    edge,
    Math.min(
      viewport.height - popover.height - edge,
      anchor.top + anchor.height / 2 - popover.height / 2,
    ),
  );
  return { left, top };
}

export function positionSidePopover(popover: HTMLElement, anchor: Element): void {
  const placement = calculateSidePopoverPlacement(
    anchor.getBoundingClientRect(),
    { width: popover.offsetWidth, height: popover.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );
  popover.style.left = `${placement.left}px`;
  popover.style.top = `${placement.top}px`;
}
