import type { SceneControl } from './contracts';

export const roadmapGates = [
  {
    title: 'Deployment',
    prompt: 'What proves that configured contracts exist on the intended chain?',
    answers: ['A marketing screenshot', 'Bytecode and chain ID reads', 'A future roadmap date'],
    correct: 1,
  },
  {
    title: 'Accounting',
    prompt: 'What must be reconciled before expansion?',
    answers: [
      'Pool value, reserves and share supply',
      'Only headline APY',
      'Number of social followers',
    ],
    correct: 0,
  },
  {
    title: 'Integrations',
    prompt: 'What separates observation from execution?',
    answers: ['The page theme', 'Registry, Plugin and LensAdapter roles', 'A token logo'],
    correct: 1,
  },
  {
    title: 'Safety',
    prompt: 'Which evidence matters before public capital?',
    answers: [
      'Repeatable pause, recovery and withdrawal tests',
      'An animated shield',
      'A guaranteed return label',
    ],
    correct: 0,
  },
  {
    title: 'Readiness',
    prompt: 'What does passing local checks mean?',
    answers: [
      'The system is audited',
      'Production is automatically approved',
      'Operational evidence passed; external gates remain',
    ],
    correct: 2,
  },
] as const;

const storageKey = 'jethos-roadmap-gate';
const element = (tag: string, className?: string, value?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};

/** Installs the wallet-free evidence game and returns complete lifecycle cleanup. */
export function installRoadmapGame(controller: SceneControl): () => void {
  const host = document.querySelector<HTMLElement>('[data-roadmap-game]');
  if (!host) return () => {};
  const original = [...host.childNodes].map((node) => node.cloneNode(true));
  const container = element('div', 'container roadmap-game__panel');
  const intro = element('div', 'roadmap-game__intro');
  intro.append(
    element('span', 'eyebrow', 'Optional interactive experience'),
    element('h2', undefined, 'Proof Path'),
    element(
      'p',
      'muted',
      'Unlock capability gates by selecting evidence that actually supports progress. No wallet, score or reward is involved.',
    ),
  );
  const game = element('div', 'roadmap-game__body');
  game.setAttribute('aria-live', 'polite');
  container.append(intro, game);
  host.replaceChildren(container);
  let index = Math.min(Number(sessionStorage.getItem(storageKey) || 0), roadmapGates.length);

  const render = (message = '') => {
    game.replaceChildren();
    const rail = element('div', 'roadmap-game__rail');
    roadmapGates.forEach((gate, gateIndex) => {
      const step = element(
        'span',
        gateIndex < index ? 'is-complete' : gateIndex === index ? 'is-current' : '',
        String(gateIndex + 1),
      );
      step.title = gate.title;
      rail.append(step);
    });
    game.append(rail);
    if (index >= roadmapGates.length) {
      game.append(
        element('h3', undefined, 'Path complete'),
        element(
          'p',
          undefined,
          'You reached product readiness without confusing evidence with an audit or guarantee.',
        ),
      );
      const reset = element(
        'button',
        'button button--secondary',
        'Reset path',
      ) as HTMLButtonElement;
      reset.type = 'button';
      reset.addEventListener('click', () => {
        index = 0;
        sessionStorage.removeItem(storageKey);
        controller.setState({ roadmap: 0 });
        render();
      });
      game.append(reset);
      return;
    }
    const gate = roadmapGates[index];
    if (!gate) return;
    game.append(
      element('span', 'badge badge--validation', `Gate ${index + 1} · ${gate.title}`),
      element('h3', undefined, gate.prompt),
    );
    const answers = element('div', 'roadmap-game__answers');
    gate.answers.forEach((answer, answerIndex) => {
      const button = element('button', 'roadmap-answer', answer) as HTMLButtonElement;
      button.type = 'button';
      button.addEventListener('click', () => {
        if (answerIndex === gate.correct) {
          index += 1;
          sessionStorage.setItem(storageKey, String(index));
          controller.setState({ roadmap: index / roadmapGates.length });
          controller.pulse(1);
          render('Correct evidence. Gate stabilized.');
        } else render('That does not prove the gate. Try again.');
      });
      answers.append(button);
    });
    game.append(answers);
    if (message) game.append(element('p', 'roadmap-game__message', message));
  };
  controller.setState({ roadmap: index / roadmapGates.length });
  render();
  return () => host.replaceChildren(...original);
}
