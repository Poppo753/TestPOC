import { colorForTier, type RouteCandidate } from './model';

const element = <Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className = '') => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

export function renderRouteCandidates(host: HTMLElement, candidates: RouteCandidate[]): void {
  const nodes = candidates.map((candidate) => {
    const row = element('div', 'architecture-route-candidate');
    const dot = element('i');
    dot.style.setProperty('--candidate-color', colorForTier(candidate.tier));
    const content = element('div');
    const name = element('strong');
    const detail = element('small');
    name.textContent = candidate.name;
    detail.textContent = candidate.detail;
    content.append(name, detail);
    const tier = element('em');
    tier.style.setProperty('--candidate-color', colorForTier(candidate.tier));
    tier.textContent = candidate.tier;
    row.append(dot, content, tier);
    return row;
  });
  host.replaceChildren(...nodes);
}
