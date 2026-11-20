import { signIn } from '../auth/gate';
import { h } from '../ui/dom';
import { page } from '../ui/layout';
import { field } from './forms';

/** Ein Zugang fuer alle Handys. Die Anmeldung bleibt auf dem Geraet gespeichert. */
export function renderLogin(onSuccess: () => void): void {
  const user = h('input', { type: 'text', autocomplete: 'username', required: true, maxlength: 80, autocapitalize: 'none' });
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true, maxlength: 200 });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Anmelden');
  const form = h('form', { class: 'form', novalidate: true }, field('Benutzername', user), field('Kennwort', password), error, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    const ok = await signIn(user.value, password.value);
    password.value = '';
    if (ok) {
      onSuccess();
      return;
    }
    error.textContent = 'Anmeldung fehlgeschlagen.';
    submit.disabled = false;
  });
  page(null, 'Anmeldung', [h('p', { class: 'lead' }, 'Einmal anmelden. Dieses Handy bleibt danach angemeldet.'), form]);
}
