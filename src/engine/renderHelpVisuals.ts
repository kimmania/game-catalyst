export function renderHelpVisuals() {
  const pour = document.getElementById('help-pour');
  const reaction = document.getElementById('help-reaction');
  const catalyst = document.getElementById('help-catalyst');
  const solidify = document.getElementById('help-solidify');

  const miniBeaker = (layers: string[], crystals: number = 0, label?: string, highlight?: boolean) => {
    const b = document.createElement('div');
    b.className = 'help-mini-beaker' + (highlight ? ' selected' : '');
    const cap = document.createElement('div');
    cap.className = 'mini-cap';
    b.appendChild(cap);
    for (const c of layers) {
      const layer = document.createElement('div');
      layer.className = 'mini-layer'; layer.style.background = `var(--${c})`;
      b.appendChild(layer);
    }
    if (crystals > 0) {
      const cryst = document.createElement('div');
      cryst.className = 'mini-crystals'; cryst.textContent = '💎'.repeat(crystals);
      b.appendChild(cryst);
    }
    if (label) {
      const lbl = document.createElement('div');
      lbl.className = 'mini-label'; lbl.textContent = label;
      b.appendChild(lbl);
    }
    return b;
  };

  if (pour) {
    // Pouring: stack on top regardless of underlying color
    pour.appendChild(miniBeaker(['crimson','crimson'], 0, 'From', true));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '➡';
    pour.appendChild(arrow);
    pour.appendChild(miniBeaker(['amber','crimson','crimson'], 0, 'To'));
  }

  if (reaction) {
    // Adjacent primary layers react to form intermediate
    reaction.appendChild(miniBeaker(['crimson'], 0, 'Layer 1'));
    const plus = document.createElement('div');
    plus.className = 'help-arrow'; plus.textContent = '+';
    reaction.appendChild(plus);
    reaction.appendChild(miniBeaker(['amber'], 0, 'Layer 2'));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '=';
    reaction.appendChild(arrow);
    reaction.appendChild(miniBeaker(['orange'], 0, 'Result'));
  }

  if (catalyst) {
    catalyst.appendChild(miniBeaker(['orange'], 0, 'Intermediate'));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '🔥➡';
    catalyst.appendChild(arrow);
    catalyst.appendChild(miniBeaker(['amber','crimson'], 0, 'Split'));
  }

  if (solidify) {
    solidify.appendChild(miniBeaker(['crimson','crimson','crimson','crimson'], 0, 'Before'));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '➡';
    solidify.appendChild(arrow);
    solidify.appendChild(miniBeaker(['crimson','crimson'], 2, 'After'));
  }
}
