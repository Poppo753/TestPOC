export function showToast(message: unknown, { duration = 5000 } = {}): HTMLElement {
  const region = document.querySelector<HTMLElement>('[data-app-toasts]') ?? document.body;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = String(message);
  region.append(toast);
  const timer = window.setTimeout(() => toast.remove(), duration);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    toast.remove();
  });
  return toast;
}
