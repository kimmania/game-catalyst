export function renderHelpVisuals() {
  const pour = document.getElementById('help-pour');
  const reaction = document.getElementById('help-reaction');
  const catalyst = document.getElementById('help-catalyst');
  const solidify = document.getElementById('help-solidify');

  const miniBeaker = (layers: string[], crystals: string[] = [], label?: string, highlight?: boolean) => {
    const b = document.createElement('div');
    b.className = 'help-mini-beaker' + (highlight ? ' selected' : '');
    const cap = document.createElement('div');
    cap.className = 'mini-cap';
    b.appendChild(cap);
    for (const c of crystals) {
      const cryst = document.createElement('div');
      cryst.className = 'mini-crystal';
      cryst.dataset.color = c;
      b.appendChild(cryst);
    }
    for (const c of layers) {
      const layer = document.createElement('div');
      layer.className = 'mini-layer'; layer.dataset.color = c;
      b.appendChild(layer);
    }
    if (label) {
      const lbl = document.createElement('div');
      lbl.className = 'mini-label'; lbl.textContent = label;
      b.appendChild(lbl);
    }
    return b;
  };

  if (pour) {
    pour.innerHTML = '';
    // Pouring: crimson onto a beaker containing amber → stacks on top
    pour.appendChild(miniBeaker(['crimson','crimson'], [], 'From', true));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '➡';
    pour.appendChild(arrow);
    pour.appendChild(miniBeaker(['amber','crimson','crimson'], [], 'To'));
  }

  if (reaction) {
    reaction.innerHTML = '';
    // Adjacent primary layers (crimson + amber) react to form orange
    reaction.appendChild(miniBeaker(['crimson','amber'], [], 'Touch'));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '➡';
    reaction.appendChild(arrow);
    reaction.appendChild(miniBeaker(['orange'], [], 'Result'));
  }

  if (catalyst) {
    catalyst.innerHTML = '';
    // Catalyst splits orange back into its parent colors
    catalyst.appendChild(miniBeaker(['orange'], [], 'Intermediate'));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '🔥➡';
    catalyst.appendChild(arrow);
    catalyst.appendChild(miniBeaker(['amber','crimson'], [], 'Split'));
  }

  if (solidify) {
    solidify.innerHTML = '';
    // Solidification: two consecutive crimson layers become a crystal at the bottom
    solidify.appendChild(miniBeaker(['crimson','crimson'], [], 'Before'));
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow'; arrow.textContent = '➡';
    solidify.appendChild(arrow);
    solidify.appendChild(miniBeaker(['crimson'], ['crimson'], 'After'));
    // Note: the crystal sits at the BOTTOM of the beaker, replacing the pair
  }
}
