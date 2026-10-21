import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import './styles.css';

import { loadSettings } from './state';
import { getSettings } from './db';
import { renderSetup } from './screens/setup';
import { renderHome } from './screens/home';
import { renderFlow } from './screens/flow';
import { renderDays, renderDay } from './screens/days';
import { renderData } from './screens/data';
import { renderAnalysis } from './screens/analysis';
import { renderInfo } from './screens/info';
import { h, mount } from './ui/dom';

void navigator.storage?.persist?.().catch(() => undefined);

async function route(): Promise<void> {
  const s = await loadSettings();
  const path = location.hash.replace(/^#/, '') || '/';

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
    case '/einstellungen':
      return renderSetup(await getSettings(), () => {
        location.hash = '#/';
      });
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
