import { APP_VERSION, DSST, KSS_LABELS, KSS_QUESTION, PLAUSIBILITY, PVT } from '../config';
import { getSettings } from '../db';
import { h } from '../ui/dom';
import { page } from '../ui/layout';

const row = (k: string, v: string) => h('tr', null, h('th', { scope: 'row' }, k), h('td', null, v));
const table = (caption: string, rows: HTMLElement[]) => h('table', { class: 'table params' }, h('caption', null, caption), h('tbody', null, ...rows));
const sec = (ms: number) => `${(ms / 1000).toLocaleString('de-CH')} s`;

export async function renderInfo(): Promise<void> {
  const s = await getSettings();
  page(
    s,
    'Testparameter',
    [
      h('p', { class: 'lead' }, 'Alle Parameter, wie sie in der App umgesetzt sind. Für das Methodenkapitel der BMA.'),
      h('h2', null, 'Ablauf'),
      h(
        'ol',
        { class: 'sequence' },
        h('li', null, 'Vorab: Aufstehzeit, Koffein. Die App berechnet die Minuten seit dem Aufstehen.'),
        h('li', null, 'KSS (Karolinska Sleepiness Scale)'),
        h('li', null, 'PVT (Psychomotor Vigilance Test)'),
        h('li', null, 'DSST (Digit Symbol Substitution Test)'),
        h('li', null, 'Schlafwerte aus der Google-Health-App'),
        h('li', null, 'Tagebuch'),
      ),
      h('p', null, 'Die Reihenfolge ist fest und kann nicht übersprungen werden. Ergebnisse werden den Probanden nicht angezeigt.'),

      h('h2', null, 'KSS'),
      h('p', null, 'Åkerstedt und Gillberg (1990). 9 Stufen, alle beschriftet. Deutsche Arbeitsübersetzung.'),
      h('p', { class: 'question' }, KSS_QUESTION),
      h('ol', { class: 'kss-ref' }, ...Object.values(KSS_LABELS).map((l) => h('li', null, l))),

      h('h2', null, 'PVT'),
      table('Nach Dinges und Powell (1985), Basner und Dinges (2011), Touchscreen nach Kay et al. (2013)', [
        row('Testdauer', `${PVT.durationMs / 60_000} min`),
        row('Zwischenreizintervall', `gleichverteilt ${sec(PVT.isiMinMs)} bis ${sec(PVT.isiMaxMs)}, gemessen ab der Reaktion`),
        row('Reiz', 'Roter Millisekunden-Zähler, der ab 0 hochzählt'),
        row('Reaktion', 'Berührung des Bildschirms (pointerdown)'),
        row('Fehlstart', `Reaktion ohne Reiz oder unter ${PVT.falseStartBelowMs} ms`),
        row('Aussetzer', `Reaktion ab ${PVT.lapseFromMs} ms, zusätzlich jede Zeitüberschreitung`),
        row('Zeitüberschreitung', `keine Reaktion nach ${sec(PVT.timeoutMs)}`),
        row('Rückmeldung', `Reaktionszeit ${sec(PVT.feedbackMs)} sichtbar`),
        row('Zeitmessung', 'performance.now und event.timeStamp, Reizbeginn = Zeitstempel des requestAnimationFrame, in dem der Reiz erscheint'),
        row('Abbruch', 'Wechsel in den Hintergrund bricht ab, der Versuch bleibt als ungültig gespeichert'),
        row('Bildwiederholrate', '1000 geteilt durch den mittleren Abstand der requestAnimationFrame-Zeitstempel'),
      ]),
      table('Kennwerte', [
        row('responses', 'Reaktionen auf einen Reiz ab 100 ms'),
        row('pvt_mean_rt, pvt_median_rt', 'Mittelwert und Median der Reaktionszeit, ohne Zeitüberschreitungen'),
        row('pvt_mean_speed', 'Mittelwert von 1000 / Reaktionszeit (1/s), Hauptkennwert'),
        row('pvt_lapses', 'Aussetzer inklusive Zeitüberschreitungen'),
        row('pvt_lapse_prob', 'Aussetzer / Reize'),
        row('pvt_performance_score', '1 - (Aussetzer + Fehlstarts) / (Reize + Fehlstarts)'),
        row('pvt_fastest10_rt', 'Mittelwert der schnellsten 10 % der Reaktionen'),
        row('pvt_slowest10_speed', 'Mittelwert von 1000 / RT der langsamsten 10 %'),
      ]),

      h('h2', null, 'DSST'),
      table('Computergestützt, Zuordnung bei jeder Durchführung neu gemischt', [
        row('Testdauer', sec(DSST.durationMs)),
        row('Übung', `${DSST.practiceTrials} Durchgänge mit der heutigen Zuordnung, nicht gewertet`),
        row('Symbole', `${DSST.symbolCount} abstrakte Formen, als SVG gezeichnet`),
        row('Antwort', 'Ziffernblock 1 bis 9, feste Anordnung'),
        row('Folge', 'Zufällig, nie zweimal dasselbe Symbol hintereinander'),
        row('Rückmeldung', 'keine'),
        row('Kennwerte', 'richtige (Hauptkennwert) und falsche Antworten, Genauigkeit, mittlere Reaktionszeit der richtigen'),
      ]),

      h('h2', null, 'Schlafwerte'),
      h('p', null, 'Abgetippt aus der Google-Health-App: Schlafdauer, Einschlaf- und Aufwachzeit, HRV, Ruhepuls. Schlafphasen und Schlafscore werden bewusst nicht erfasst. Nachtragen bis Ende des Folgetags möglich.'),
      table('Plausibilitätswarnungen (blockieren nicht)', [
        row('Schlafdauer', `${PLAUSIBILITY.sleepMinutes.min} bis ${PLAUSIBILITY.sleepMinutes.max} min`),
        row('HRV', `${PLAUSIBILITY.hrvMs.min} bis ${PLAUSIBILITY.hrvMs.max} ms`),
        row('Ruhepuls', `${PLAUSIBILITY.restingHr.min} bis ${PLAUSIBILITY.restingHr.max} /min`),
      ]),

      h('h2', null, 'Studieneinstellungen'),
      s
        ? table('Auf diesem Handy', [
            row('Proband', s.participantId),
            row('Übungswoche ab', s.practiceStart),
            row('Hauptmessung', `${s.mainStart} bis ${s.endDate}`),
            row('Zeitfenster', `${s.windowMinMinutes} bis ${s.windowMaxMinutes} min nach dem Aufstehen`),
            row('Geräte-ID', s.primaryDeviceId),
            row('App-Version', APP_VERSION),
          ])
        : h('p', null, 'Noch nicht eingerichtet.'),
    ],
    { href: '#/', label: 'Übersicht' },
  );
}
