/**
 * Orchestrates the "Why Jethos" synthesis scene.
 *
 * The animation is deliberately progressive rather than decorative: the two
 * source cards arrive first, their paths converge, and only then does the
 * central Jethos interface become fully visible. Hovering or focusing a source
 * highlights the exact contribution it makes to the resulting experience.
 */
document.querySelectorAll('[data-financial-synthesis]').forEach((section) => {
  const scene = section.querySelector('[data-synthesis-scene]');
  const sources = [...section.querySelectorAll('[data-synthesis-source]')];
  if (!scene || !sources.length) return;

  const activate = (sourceId = '') => {
    if (sourceId) scene.dataset.active = sourceId;
    else scene.removeAttribute('data-active');

    sources.forEach((source) => {
      source.classList.toggle('is-active', source.dataset.synthesisSource === sourceId);
    });
  };

  sources.forEach((source) => {
    const sourceId = source.dataset.synthesisSource;

    source.addEventListener('mouseenter', () => activate(sourceId));
    source.addEventListener('focus', () => activate(sourceId));
    source.addEventListener('mouseleave', () => {
      if (!source.matches(':focus')) activate();
    });
    source.addEventListener('blur', () => activate());
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scene.classList.add('is-assembled');
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    scene.classList.add('is-assembled');
    observer.disconnect();
  }, { threshold: 0.28 });

  observer.observe(scene);
});
