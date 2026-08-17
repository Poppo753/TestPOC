import type { DisposableController } from '../../../core/disposable';

export const allocations = {
  reserve: { value: '35%', label: 'Liquid reserve' },
  aave: { value: '25%', label: 'Aave V3' },
  euler: { value: '20%', label: 'Euler V2' },
  morpho: { value: '20%', label: 'Morpho' },
} as const;

type AllocationId = keyof typeof allocations;
type AllocationControl = HTMLElement | SVGElement;

const isAllocationId = (value: string | undefined): value is AllocationId =>
  Boolean(value && Object.hasOwn(allocations, value));

export function mountReceiptAllocation(component: HTMLElement): DisposableController {
  const rows = [...component.querySelectorAll<HTMLElement>('[data-receipt-allocation]')];
  const slices = [...component.querySelectorAll<SVGElement>('[data-receipt-slice]')];
  const chartValue = component.querySelector<SVGTextElement>('[data-receipt-chart-value]');
  const chartLabel = component.querySelector<SVGTextElement>('[data-receipt-chart-label]');
  const events = new AbortController();
  const pendingTimers = new Set<number>();

  if (!chartValue || !chartLabel || rows.length === 0 || slices.length === 0) {
    throw new Error('Receipt allocation markup is incomplete.');
  }

  const render = (allocationId?: AllocationId) => {
    for (const row of rows) {
      row.classList.toggle('is-active', row.dataset.receiptAllocation === allocationId);
    }
    for (const slice of slices) {
      slice.classList.toggle('is-active', slice.dataset.receiptSlice === allocationId);
    }
    const allocation = allocationId ? allocations[allocationId] : undefined;
    chartValue.textContent = allocation?.value ?? '100%';
    chartLabel.textContent = allocation?.label ?? 'mapped';
  };
  const bind = (control: AllocationControl, allocationId: AllocationId) => {
    control.addEventListener('mouseenter', () => render(allocationId), { signal: events.signal });
    control.addEventListener('focus', () => render(allocationId), { signal: events.signal });
    control.addEventListener(
      'mouseleave',
      () => {
        if (!component.matches(':focus-within')) render();
      },
      { signal: events.signal },
    );
    control.addEventListener(
      'blur',
      () => {
        const timer = window.setTimeout(() => {
          pendingTimers.delete(timer);
          if (!component.matches(':focus-within')) render();
        });
        pendingTimers.add(timer);
      },
      { signal: events.signal },
    );
  };

  for (const row of rows) {
    if (isAllocationId(row.dataset.receiptAllocation)) bind(row, row.dataset.receiptAllocation);
  }
  for (const slice of slices) {
    if (isAllocationId(slice.dataset.receiptSlice)) bind(slice, slice.dataset.receiptSlice);
  }

  return {
    destroy() {
      events.abort();
      for (const timer of pendingTimers) window.clearTimeout(timer);
      pendingTimers.clear();
      render();
    },
  };
}
