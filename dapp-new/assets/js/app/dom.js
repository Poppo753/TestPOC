/**
 * Safe DOM primitives for the PoC App.
 * Runtime values from RPC/wallet are always assigned through textContent.
 */
export const byId = (id) => document.getElementById(id);

export function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = String(value ?? '');
  return node;
}

export function setLink(id, href, label) {
  const node = byId(id);
  if (!node) return null;
  node.href = href;
  node.textContent = label;
  return node;
}

export function element(tag, { className, text, attributes = {} } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

export function replaceMessage(target, message, className = 'muted') {
  if (!target) return;
  target.replaceChildren(element('p', { className, text: message }));
}

export function setActionAvailability({ connected, correctChain, busy }) {
  document.querySelectorAll('[data-requires-wallet]').forEach((node) => {
    node.disabled = !connected || !correctChain || busy;
  });
}

