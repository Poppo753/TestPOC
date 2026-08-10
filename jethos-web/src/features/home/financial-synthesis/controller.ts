import type { DisposableController } from '../../../core/disposable';

export function mountFinancialSynthesis(section: HTMLElement): DisposableController {
  const scene = section.querySelector<HTMLElement>('[data-synthesis-scene]');
  const sources = [...section.querySelectorAll<HTMLElement>('[data-synthesis-source]')];
  const events = new AbortController();
  let observer: IntersectionObserver | undefined;

  if (!scene || sources.length === 0) throw new Error('Financial synthesis markup is incomplete.');

  const activate = (sourceId?: string) => {
    if (sourceId) scene.dataset.active = sourceId;
    else delete scene.dataset.active;
    for (const source of sources) {
      source.classList.toggle('is-active', source.dataset.synthesisSource === sourceId);
    }
  };

  for (const source of sources) {
    const sourceId = source.dataset.synthesisSource;
    source.addEventListener('mouseenter', () => activate(sourceId), { signal: events.signal });
    source.addEventListener('focus', () => activate(sourceId), { signal: events.signal });
    source.addEventListener(
      'mouseleave',
      () => {
        if (!source.matches(':focus')) activate();
      },
      { signal: events.signal },
    );
    source.addEventListener('blur', () => activate(), { signal: events.signal });
  }

  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window)
  ) {
    scene.classList.add('is-assembled');
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        scene.classList.add('is-assembled');
        observer?.disconnect();
      },
      { threshold: 0.28 },
    );
    observer.observe(scene);
  }

  return {
    destroy() {
      observer?.disconnect();
      events.abort();
      activate();
    },
  };
}
