const GATES = [
  { title: 'Deployment', prompt: 'What proves that configured contracts exist on the intended chain?', answers: ['A marketing screenshot', 'Bytecode and chain ID reads', 'A future roadmap date'], correct: 1 },
  { title: 'Accounting', prompt: 'What must be reconciled before expansion?', answers: ['Pool value, reserves and share supply', 'Only headline APY', 'Number of social followers'], correct: 0 },
  { title: 'Integrations', prompt: 'What separates observation from execution?', answers: ['The page theme', 'Registry, Plugin and LensAdapter roles', 'A token logo'], correct: 1 },
  { title: 'Safety', prompt: 'Which evidence matters before public capital?', answers: ['Repeatable pause, recovery and withdrawal tests', 'An animated shield', 'A guaranteed return label'], correct: 0 },
  { title: 'Readiness', prompt: 'What does passing local checks mean?', answers: ['The system is audited', 'Production is automatically approved', 'Operational evidence passed; external gates remain'], correct: 2 },
];
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }

/** Optional, wallet-free evidence game. Session storage retains only progress. */
export function installRoadmapGame(controller) {
  const host = document.querySelector('[data-roadmap-game]'); if (!host) return;
  const container = el('div', 'container roadmap-game__panel');
  const intro = el('div', 'roadmap-game__intro'); intro.append(el('span', 'eyebrow', 'Optional interactive experience'), el('h2', null, 'Proof Path'), el('p', 'muted', 'Unlock capability gates by selecting evidence that actually supports progress. No wallet, score or reward is involved.'));
  const game = el('div', 'roadmap-game__body'); game.setAttribute('aria-live', 'polite'); container.append(intro, game); host.replaceChildren(container);
  let index = Math.min(Number(sessionStorage.getItem('jethos-roadmap-gate') || 0), GATES.length);
  function render(message = '') {
    game.replaceChildren(); const rail = el('div', 'roadmap-game__rail');
    GATES.forEach((gate, gateIndex) => { const step = el('span', gateIndex < index ? 'is-complete' : gateIndex === index ? 'is-current' : '', String(gateIndex + 1)); step.title = gate.title; rail.append(step); }); game.append(rail);
    if (index >= GATES.length) { game.append(el('h3', null, 'Path complete'), el('p', null, 'You reached product readiness without confusing evidence with an audit or guarantee.')); const reset = el('button', 'button button--secondary', 'Reset path'); reset.type = 'button'; reset.addEventListener('click', () => { index = 0; sessionStorage.removeItem('jethos-roadmap-gate'); controller.setState({ roadmap: 0 }); render(); }); game.append(reset); return; }
    const gate = GATES[index]; game.append(el('span', 'badge badge--validation', `Gate ${index + 1} · ${gate.title}`), el('h3', null, gate.prompt)); const answers = el('div', 'roadmap-game__answers');
    gate.answers.forEach((answer, answerIndex) => { const button = el('button', 'roadmap-answer', answer); button.type = 'button'; button.addEventListener('click', () => { if (answerIndex === gate.correct) { index += 1; sessionStorage.setItem('jethos-roadmap-gate', String(index)); controller.setState({ roadmap: index / GATES.length }); controller.pulse(1); render('Correct evidence. Gate stabilized.'); } else render('That does not prove the gate. Try again.'); }); answers.append(button); }); game.append(answers); if (message) game.append(el('p', 'roadmap-game__message', message));
  }
  controller.setState({ roadmap: index / GATES.length }); render();
}

