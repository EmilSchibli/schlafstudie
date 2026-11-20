import { AuthFailed, Offline, signIn } from '../cloud/auth';
import { cloudConfig } from '../cloud/config';
import { scheduleSync } from '../cloud/sync';
import { h } from '../ui/dom';
import { page } from '../ui/layout';
import { field } from './forms';

/** Gemeinsames Studienkonto. Das Kennwort bleibt auf dem Server, nicht im Programm. */
export function renderLogin(onSuccess: () => void): void {
  const config = cloudConfig();
  if (!config) return;
  const email = h('input', {
    type: 'email',
    autocomplete: 'username',
    required: true,
    maxlength: 200,
    inputmode: 'email',
  });
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true, maxlength: 200 });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Anmelden');
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    field('E-Mail', email),
    field('Kennwort', password),
    error,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    try {
      await signIn(config, email.value, password.value);
      password.value = '';
      scheduleSync();
      onSuccess();
    } catch (err) {
      error.textContent = err instanceof Offline ? 'Keine Verbindung. Internet prüfen.' : err instanceof AuthFailed ? err.message : 'Anmeldung fehlgeschlagen.';
      submit.disabled = false;
    }
  });
  page(null, 'Anmeldung', [
    h('p', { class: 'lead' }, 'Zugang nur mit dem Studienkonto. Dieselbe Anmeldung gilt für alle Handys und für den Computer, auf dem am Ende ausgewertet wird.'),
    form,
    h('p', { class: 'hint' }, h('a', { href: '#/info' }, 'Testparameter ansehen')),
  ]);
}
