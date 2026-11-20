import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import './styles.css';

import { loadSettings } from './state';
import { allDays, getSettings, onDatabaseWrite } from './db';
import { cloudConfig } from './cloud/config';
import { ensureAccess } from './cloud/auth';
import { scheduleSync, watchOnline } from './cloud/sync';
import { renderLogin } from './screens/login';
import { renderSetup } from './screens/setup';
import { renderHome } from './screens/home';
import { renderFlow } from './screens/flow';
import { renderDays, renderDay } from './screens/days';
import { renderData } from './screens/data';
import { renderAnalysis } from './screens/analysis';
import { renderInfo } from './screens/info';
import { h, mount, toast } from './ui/dom';

void navigator.storage?.persist?.().catch(() => undefined);
onDatabaseWrite(() => scheduleSync());
watchOnline();

// Fehler in Knopf- und Formularaktionen (zum Beispiel beim Speichern) duerfen nicht unbemerkt bleiben.
function reportActionError(err: unknown): void {
  console.error(err);
  // Waehrend PVT und DSST nichts einblenden, das von der Aufgabe ablenkt.
  if (document.body.classList.contains('test-running')) return;
  toast('Das hat nicht funktioniert. Bitte nochmals versuchen.');
}
window.addEventListener('unhandledrejection', (e) => reportActionError(e.reason));
window.addEventListener('error', (e) => reportActionError(e.error ?? e.message));

async function route(): Promise<void> {
  const path = location.hash.replace(/^#/, '') || '/';
  const config = cloudConfig();
  if (config && path !== '/info') {
    const access = await ensureAccess(config);
    if (access !== 'ok') return renderLogin(() => void route());
  }

  const s = await loadSettings();

  if (!s) {
    if (path === '/info') return renderInfo();
    return renderSetup(null, () => {
      location.hash = '#/';
      void route();
    });
  }

  const dayMatch = path.match(/^\/tag\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch) return renderDay(dayMatch[1]);

  switch (path) {
    case '/':
      return renderHome();
    case '/morgen':
      return renderFlow();
    case '/tage':
      return renderDays();
    case '/daten':
      return renderData();
    case '/auswertung':
      return renderAnalysis();
    case '/info':
      return renderInfo();
    case '/einstellungen': {
      const hasDays = (await allDays()).length > 0;
      return renderSetup(await getSettings(), () => (location.hash = '#/'), hasDays);
    }
    default:
      location.hash = '#/';
  }
}

window.addEventListener('hashchange', () => void route().catch(showError));

function showError(err: unknown): void {
  console.error(err);
  mount(
    h(
      'main',
      { class: 'page' },
      h('h1', null, 'Fehler'),
      h('p', null, 'Die App konnte diesen Bildschirm nicht anzeigen. Die gespeicherten Daten sind davon nicht betroffen.'),
      h('pre', { class: 'error-detail' }, String(err instanceof Error ? err.message : err)),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Zur Übersicht'),
    ),
  );
}

void route().catch(showError);
