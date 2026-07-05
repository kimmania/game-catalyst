import { COLOR_NAME, COLOR_ID } from './constants';

export function renderHelpVisuals(showLabels = false) {
  const pour = document.getElementById('help-pour');
  const reaction = document.getElementById('help-reaction');
  const catalyst = document.getElementById('help-catalyst');
  const solidify = document.getElementById('help-solidify');

  const colorName: Record<string, string> = {
    crimson: 'Crimson',
    amber: 'Amber',
    orange: 'Orange',
  };

  const labelSpan = (color: string) => {
    if (!showLabels) return null;
    const span = document.createElement('span');
    span.className = 'layer-label';
    const name = COLOR_NAME[color] ?? color;
    const id = COLOR_ID[color];
    span.textContent = id !== undefined ? `${name} ${id}` : name;
    span.setAttribute('aria-hidden', 'true');
    return span;
  };

  const miniLayer = (color: string) => {
    const l = document.createElement('div');
    l.className = 'mini-layer';
    l.dataset.color = color;
    const label = labelSpan(color);
    if (label) l.appendChild(label);
    return l;
  };

  const helpArrow = () => {
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow';
    arrow.textContent = '➡';
    return arrow;
  };

  const miniCrystal = (color: string) => {
    const c = document.createElement('div');
    c.className = 'mini-crystal';
    c.dataset.color = color;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `${colorName[color] ?? color} crystal`);
    const label = labelSpan(color);
    if (label) c.appendChild(label);
    return c;
  };

  const miniBeaker = (layers: string[], crystals: string[] = [], label?: string, highlight?: boolean) => {
    const b = document.createElement('div');
    b.className = 'help-mini-beaker' + (highlight ? ' selected' : '');
    for (const c of crystals) {
      b.appendChild(miniCrystal(c));
    }
    for (const c of layers) {
      b.appendChild(miniLayer(c));
    }
    if (label) {
      const lbl = document.createElement('div');
      lbl.className = 'mini-label';
      lbl.textContent = label;
      b.appendChild(lbl);
    }
    return b;
  };

  if (pour) {
    pour.innerHTML = '';
    // Pour two crimsons from the first beaker onto an amber top
    pour.appendChild(miniBeaker(['crimson', 'crimson'], [], 'From', true));
    pour.appendChild(helpArrow());
    pour.appendChild(miniBeaker(['crimson', 'crimson', 'amber'], [], 'To'));
  }

  if (reaction) {
    reaction.innerHTML = '';
    reaction.appendChild(miniBeaker(['amber', 'crimson'], [], 'Touch'));
    reaction.appendChild(helpArrow());
    reaction.appendChild(miniBeaker(['orange'], [], 'Result'));
  }

  if (catalyst) {
    catalyst.innerHTML = '';
    catalyst.appendChild(miniBeaker(['orange'], [], 'Intermediate'));
    const arrow = helpArrow();
    arrow.textContent = '🔥➡';
    catalyst.appendChild(arrow);
    catalyst.appendChild(miniBeaker(['crimson', 'amber'], [], 'Split'));
  }

  if (solidify) {
    solidify.innerHTML = '';
    solidify.appendChild(miniBeaker(['crimson', 'crimson'], [], 'Before'));
    solidify.appendChild(helpArrow());
    solidify.appendChild(miniBeaker(['crimson'], ['crimson'], 'After'));
  }
}
