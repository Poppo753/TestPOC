let region;
function getRegion() {
  if (region) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  return region;
}

export function showToast(message, { duration = 5000 } = {}) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = String(message);
  getRegion().append(toast);
  const timer = setTimeout(() => toast.remove(), duration);
  toast.addEventListener('click', () => { clearTimeout(timer); toast.remove(); });
  return toast;
}

