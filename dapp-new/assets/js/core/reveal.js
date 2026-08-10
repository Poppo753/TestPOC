/** Progressive enhancement: content remains readable when IntersectionObserver
 * is unavailable and all motion is disabled for reduced-motion users. */
export function initReveal() {
  const explicitElements = document.querySelectorAll('.reveal');

  // Editorial pages predate the opt-in class used by the homepage. When a page
  // has no explicit choreography, reveal the direct content blocks in each
  // section and stagger only siblings that enter together.
  if (!explicitElements.length) {
    document.querySelectorAll('main > :is(header, section) > .container').forEach((group) => {
      [...group.children].forEach((element, index) => {
        element.classList.add('reveal');
        element.style.setProperty('--reveal-delay', `${Math.min(index, 4) * 70}ms`);
      });
    });
  }

  const elements = [...document.querySelectorAll('.reveal')];
  if (!elements.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  elements.forEach((element) => observer.observe(element));
}
