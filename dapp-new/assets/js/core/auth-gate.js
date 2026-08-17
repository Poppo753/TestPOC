/**
 * Lightweight preview gate.
 *
 * This deliberately provides only client-side access friction: credentials
 * shipped to a browser can always be discovered and static files remain
 * reachable from the server. Use server-side authentication before relying on
 * this for confidential material.
 */
const SESSION_KEY = 'jethos-preview-authenticated';
const PREVIEW_CREDENTIAL = 'Poppo753';

function createField(label, type, autocomplete) {
  const wrapper = document.createElement('label');
  wrapper.className = 'auth-gate__field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.name = type === 'password' ? 'password' : 'username';
  input.autocomplete = autocomplete;
  input.required = true;
  input.spellcheck = false;
  wrapper.append(caption, input);
  return { wrapper, input };
}

function unlock(overlay) {
  sessionStorage.setItem(SESSION_KEY, 'true');
  document.documentElement.dataset.authState = 'authenticated';
  document.body.classList.remove('auth-locked');
  overlay.remove();
  window.dispatchEvent(new CustomEvent('jethos:authenticated'));
}

export function requireAuthentication() {
  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    document.documentElement.dataset.authState = 'authenticated';
    return Promise.resolve();
  }

  document.documentElement.dataset.authState = 'locked';
  document.body.classList.add('auth-locked');

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'auth-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'auth-gate-title');

    const panel = document.createElement('div');
    panel.className = 'auth-gate__panel';
    const mark = document.createElement('img');
    mark.className = 'auth-gate__mark';
    const root = document.documentElement.dataset.root || '.';
    mark.src = `${root}/assets/brand/jethos-mark.svg`;
    mark.alt = '';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Private preview';
    const title = document.createElement('h1');
    title.id = 'auth-gate-title';
    title.textContent = 'Enter Jethos';
    const introduction = document.createElement('p');
    introduction.className = 'auth-gate__intro';
    introduction.textContent = 'Use the preview credentials to continue.';

    const form = document.createElement('form');
    form.className = 'auth-gate__form';
    const username = createField('Username', 'text', 'username');
    const password = createField('Password', 'password', 'current-password');
    const error = document.createElement('p');
    error.className = 'auth-gate__error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const submit = document.createElement('button');
    submit.className = 'button button--primary auth-gate__submit';
    submit.type = 'submit';
    submit.textContent = 'Enter';
    form.append(username.wrapper, password.wrapper, error, submit);
    panel.append(mark, eyebrow, title, introduction, form);
    overlay.append(panel);
    document.body.append(overlay);
    username.input.focus();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const valid = username.input.value === PREVIEW_CREDENTIAL && password.input.value === PREVIEW_CREDENTIAL;
      if (!valid) {
        error.textContent = 'Incorrect username or password.';
        error.hidden = false;
        password.input.value = '';
        password.input.focus();
        return;
      }
      unlock(overlay);
      resolve();
    });
  });
}
