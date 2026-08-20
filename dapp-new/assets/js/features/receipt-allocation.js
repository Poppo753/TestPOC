/**
 * Synchronizes the allocation list in the transparency receipt with its SVG
 * donut. Every route has one stable id shared by its row and chart segment, so
 * hover and keyboard focus always reveal the same information in both views.
 */
const ALLOCATIONS = Object.freeze({
  reserve: { value: '35%', label: 'Liquid reserve' },
  aave: { value: '25%', label: 'Aave V3' },
  euler: { value: '20%', label: 'Euler V2' },
  morpho: { value: '20%', label: 'Morpho' },
});

document.querySelectorAll('[data-receipt-allocation-chart]').forEach((component) => {
  const rows = [...component.querySelectorAll('[data-receipt-allocation]')];
  const slices = [...component.querySelectorAll('[data-receipt-slice]')];
  const chartValue = component.querySelector('[data-receipt-chart-value]');
  const chartLabel = component.querySelector('[data-receipt-chart-label]');

  function render(allocationId = null) {
    rows.forEach((row) => row.classList.toggle('is-active', row.dataset.receiptAllocation === allocationId));
    slices.forEach((slice) => slice.classList.toggle('is-active', slice.dataset.receiptSlice === allocationId));
    const allocation = allocationId ? ALLOCATIONS[allocationId] : null;
    chartValue.textContent = allocation?.value ?? '100%';
    chartLabel.textContent = allocation?.label ?? 'mapped';
  }

  function bind(control, allocationId) {
    control.addEventListener('mouseenter', () => render(allocationId));
    control.addEventListener('focus', () => render(allocationId));
    control.addEventListener('mouseleave', () => {
      if (!component.matches(':focus-within')) render();
    });
    control.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!component.matches(':focus-within')) render();
      }, 0);
    });
  }

  rows.forEach((row) => bind(row, row.dataset.receiptAllocation));
  slices.forEach((slice) => bind(slice, slice.dataset.receiptSlice));
});
