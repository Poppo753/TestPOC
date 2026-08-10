import {
  allocationColors,
  contextLabel,
  scenarioAdjustment,
  type VaultChain,
  type VaultDefinition,
  type VaultMode,
  type VaultToken,
} from './vault-model';

interface PopoverElements {
  popover: HTMLElement;
  title: HTMLElement;
  summary: HTMLElement;
  allocations: HTMLElement;
  slices: SVGElement;
  chartValue: SVGTextElement;
  chartLabel: SVGTextElement;
}

export function renderVaultPopover(
  elements: PopoverElements,
  vault: VaultDefinition,
  mode: VaultMode,
  chain: VaultChain,
  token: VaultToken,
  signal: AbortSignal,
): void {
  const { popover, title, summary, allocations, slices, chartValue, chartLabel } = elements;
  title.textContent = `${vault.name} · ${contextLabel(mode, chain, token)}`;
  summary.textContent = `Where this illustrative ${vault.name.toLowerCase()} vault would place its capital.`;
  allocations.replaceChildren();
  slices.replaceChildren();
  slices.closest('svg')?.setAttribute('role', 'group');

  const head = document.createElement('div');
  head.className = 'ownership-allocation-head';
  head.setAttribute('aria-hidden', 'true');
  head.append(document.createElement('span'));
  for (const caption of ['Share', 'APY']) {
    const label = document.createElement('span');
    label.textContent = caption;
    head.append(label);
  }
  allocations.append(head);

  const rows: HTMLButtonElement[] = [];
  const chartSlices: SVGCircleElement[] = [];
  let offset = 0;
  vault.allocations.forEach((allocation, index) => {
    const color = allocationColors[index] ?? allocationColors[0];
    const adjustedApy =
      allocation.apy === 0 ? 0 : allocation.apy + scenarioAdjustment(mode, chain, token);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'ownership-allocation-row';
    row.dataset.allocationIndex = String(index);
    row.style.setProperty('--allocation-color', color);
    row.setAttribute(
      'aria-label',
      `${allocation.label}: ${allocation.percent}% allocation, ${adjustedApy.toFixed(1)}% illustrative APY`,
    );
    const name = document.createElement('span');
    name.append(document.createElement('i'), document.createTextNode(allocation.label));
    const value = document.createElement('strong');
    value.textContent = `${allocation.percent}%`;
    const apy = document.createElement('b');
    apy.textContent = `${adjustedApy.toFixed(1)}%`;
    row.append(name, value, apy);
    allocations.append(row);
    rows.push(row);

    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    slice.classList.add('ownership-allocation-slice');
    slice.dataset.allocationIndex = String(index);
    for (const [attribute, value] of Object.entries({
      cx: '60',
      cy: '60',
      r: '42',
      pathLength: '100',
      'stroke-dasharray': `${allocation.percent} ${100 - allocation.percent}`,
      'stroke-dashoffset': String(-offset),
      tabindex: '0',
      role: 'button',
      'aria-label': `${allocation.label}: ${allocation.percent}% allocation`,
    })) {
      slice.setAttribute(attribute, value);
    }
    slice.style.setProperty('--allocation-color', color);
    slices.append(slice);
    chartSlices.push(slice);
    offset += allocation.percent;
  });

  const highlight = (index: number | null = null) => {
    rows.forEach((row, rowIndex) => row.classList.toggle('is-active', rowIndex === index));
    chartSlices.forEach((slice, sliceIndex) =>
      slice.classList.toggle('is-active', sliceIndex === index),
    );
    const allocation = index === null ? undefined : vault.allocations[index];
    chartValue.textContent = allocation ? `${allocation.percent}%` : '100%';
    chartLabel.textContent = allocation?.label ?? 'allocated';
  };
  for (const control of [...rows, ...chartSlices]) {
    const index = Number(control.dataset.allocationIndex);
    control.addEventListener('mouseenter', () => highlight(index), { signal });
    control.addEventListener('focus', () => highlight(index), { signal });
    control.addEventListener('mouseleave', () => !popover.matches(':focus-within') && highlight(), {
      signal,
    });
    control.addEventListener(
      'blur',
      () => window.setTimeout(() => !popover.matches(':focus-within') && highlight()),
      { signal },
    );
  }
}
