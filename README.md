# Schlafstudie: Testbatterie und Schlafprotokoll

Web-App fuer die BMA-Studie zu Schlaf und Aufmerksamkeit. Laeuft im Browser des Handys, funktioniert offline und speichert alles lokal auf dem Geraet.

Jeden Morgen, feste Reihenfolge:

1. Vorab: Aufstehzeit, Koffein
2. KSS (Karolinska Sleepiness Scale)
3. PVT (Psychomotor Vigilance Test), 5 Minuten
4. DSST (Digit Symbol Substitution Test), 90 Sekunden
5. Schlafwerte aus der Google-Health-App abtippen
6. Tagebuch

Alle Testparameter stehen in `src/config.ts` und in der App unter "Testparameter".

## Voraussetzungen

- Node.js 20 oder neuer (https://nodejs.org)

## Lokal starten

```
npm install
npm run dev
```

Die Adresse mit der IP-Nummer (z.B. `http://192.168.1.20:5173`) kann man zum Ausprobieren auf dem Handy im gleichen WLAN oeffnen. Achtung: Ohne HTTPS funktionieren Offline-Modus und Bildschirmsperre nicht. Fuer die Studie die Version auf GitHub Pages verwenden.

## Tests

```
npm test
```

Prueft alle Berechnungen (PVT-Kennwerte, DSST, Spearman, CSV-Format, Datumslogik, Backup) mit den Testfaellen aus der Spezifikation.

## Auf GitHub Pages veroeffentlichen

Die App verwendet relative Pfade und funktioniert deshalb unter `https://<benutzername>.github.io/<repo>/`.

1. Dieses Verzeichnis als Git-Repository auf GitHub pushen, Branch `main`.
2. Unter Settings, Pages als Quelle **GitHub Actions** waehlen.
3. Der Workflow `.github/workflows/pages.yml` testet, baut und veroeffentlicht bei jedem Push auf `main`.
4. Die Adresse steht nach dem ersten Lauf im Reiter Actions beim Deploy-Job.

Manuell, ohne Actions:

```
npm run build
npx gh-pages -d dist
```

Danach unter Settings, Pages den Branch `gh-pages` waehlen.

## Auf dem Handy installieren

Wichtig, sonst kann der Browser die Daten nach einigen Tagen loeschen.

iPhone (Safari):
1. Adresse in Safari oeffnen.
2. Teilen-Knopf, dann "Zum Home-Bildschirm".
3. Ab jetzt nur noch ueber das Symbol auf dem Home-Bildschirm oeffnen.

Android (Chrome):
1. Adresse in Chrome oeffnen.
2. Menue mit den drei Punkten, dann "App installieren" oder "Zum Startbildschirm hinzufuegen".

Beim ersten Start: Probanden-Code (P1, P2 oder P3), Daten der Phasen und das Zeitfenster nach dem Aufstehen eintragen.

## Daten

Unter "Daten" erzeugt die App:

| Datei | Inhalt |
|---|---|
| `daily_summary_P1.csv` | Eine Zeile pro Tag mit allen Kennwerten. Datei fuer die Auswertung |
| `pvt_trials_P1.csv` | Jeder einzelne PVT-Reiz mit Reaktionszeit |
| `dsst_trials_P1.csv` | Jeder einzelne DSST-Durchgang |
| `backup_P1.json` | Kompletter Datenbestand, kann wieder eingelesen werden |

CSV: Semikolon als Trennzeichen, Dezimalpunkt, UTF-8 mit BOM (oeffnet sich in Excel direkt richtig). Ja/Nein als 1/0. Leere Zellen bedeuten: kein Wert.

Ungueltige Tests (abgebrochen) erscheinen in daily_summary ohne Kennwerte, mit `pvt_valid = 0` bzw. `dsst_valid = 0`. Ihre Rohdaten bleiben in den Trial-Dateien, markiert mit `attempt_status = aborted`.

Nach jedem Protokoll das Backup senden (an sich selbst oder in den Gruppenchat). Die Startseite warnt, wenn das letzte Backup aelter als 3 Tage ist.

## Messgenauigkeit

- Zeitmessung nur mit `performance.now()` und `event.timeStamp`.
- Reizbeginn ist der Zeitstempel des `requestAnimationFrame`, in dem der Reiz erscheint.
- Reaktion bei Beruehrung (`pointerdown`), nicht beim Loslassen.
- Touchscreens haben eine geraeteabhaengige Verzoegerung von einigen zehn Millisekunden. Deshalb immer dasselbe Handy pro Person. Die App speichert eine Geraete-ID und markiert Tage mit anderem Geraet (`device_changed = 1`).
- Die Bildwiederholrate ist 1000 geteilt durch den mittleren Abstand der `requestAnimationFrame`-Zeitstempel (`refresh_rate_hz`).
- Geht die App waehrend eines Tests in den Hintergrund, wird der Test abgebrochen und als ungueltig gespeichert.

## Nicht umgesetzt

- Automatische Uebertragung an ein Google Sheet (in der Spezifikation optional, Phase 2).

## Aufbau

```
src/
  config.ts           Alle Testparameter und KSS-Beschriftungen
  metrics/            Berechnungen (PVT, DSST, Spearman), ohne Oberflaeche
  battery/            PVT- und DSST-Ablauf mit Zeitmessung
  screens/            Bildschirme
  csv.ts              CSV-Export
  db.ts               Speicherung in IndexedDB, Backup
tests/                Unit-Tests (Vitest)
```
