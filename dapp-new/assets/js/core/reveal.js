/** Progressive enhancement: content remains readable when IntersectionObserver
 * is unavailable and all motion is disabled for reduced-motion users. */
export function initReveal() {
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

