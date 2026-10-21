import { svgEl } from './dom';

// Neun abstrakte, klar unterscheidbare Symbole fuer den DSST.
// Als SVG-Pfade gezeichnet, damit sie auf allen Geraeten identisch aussehen.
// viewBox 0 0 24 24, nur Linien (stroke), keine Schriftzeichen.
export const SYMBOL_PATHS: string[] = [
  'M12 4 L20 19 L4 19 Z', // Dreieck
  'M5 5 H19 V19 H5 Z', // Quadrat
  'M12 3 L21 12 L12 21 L3 12 Z', // Raute
  'M4 4 L20 20 M20 4 L4 20', // Kreuz
  'M12 4 V20 M4 12 H20', // Plus
  'M4 8 H20 M4 16 H20', // Zwei Balken
  'M5 6 V12 A7 7 0 0 0 19 12 V6', // Becher
  'M4 18 L12 6 L20 18', // Dach
  'M12 5 A7 7 0 1 0 12.01 5 Z', // Kreis
];

export function symbolSvg(symbolId: number, size = 40): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    class: 'dsst-symbol',
    'aria-hidden': 'true',
  }) as SVGSVGElement;
  svg.append(
    svgEl('path', {
      d: SYMBOL_PATHS[symbolId],
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return svg;
}
