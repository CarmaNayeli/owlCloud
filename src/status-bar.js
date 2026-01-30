/**
 * Compact Status Bar
 * Displays HP, concentration, buffs/debuffs, resources, and advantage toggle
 */

let characterData = null;
let advantageState = 'normal';

// Effect icons mapping
const EFFECT_ICONS = {
  // Buffs
  'Bless': '🙏',
  'Guidance': '🧭',
  'Bardic Inspiration': '🎵',
  'Shield of Faith': '🛡️',
  'Haste': '⚡',
  'Heroism': '🦸',
  'Aid': '💪',
  'Protection from Evil': '✝️',
  'Sanctuary': '🏛️',
  'Blur': '👻',
  'Mirror Image': '🪞',
  'Invisibility': '👁️',
  'Greater Invisibility': '👁️',
  'Freedom of Movement': '🏃',
  'Death Ward': '💀',
  // Debuffs
  'Bane': '😰',
  'Poisoned': '🤢',
  'Frightened': '😱',
  'Charmed': '💕',
  'Stunned': '💫',
  'Paralyzed': '🧊',
  'Blinded': '🙈',
  'Deafened': '🙉',
  'Restrained': '⛓️',
  'Grappled': '🤝',
  'Prone': '🛏️',
  'Incapacitated': '😵',
  'Exhaustion': '😫',
  'Unconscious': '💤',
  'Petrified': '🗿',
  'Concentration': '🧠',
  'Hexed': '🔮'
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof debug !== 'undefined') debug.log('📊 Status bar loaded');

  // Close button
  document.getElementById('close-btn').addEventListener('click', () => window.close());

  // Advantage toggle buttons
  document.getElementById('adv-btn').addEventListener('click', () => setAdvantage('advantage'));
  document.getElementById('norm-btn').addEventListener('click', () => setAdvantage('normal'));
  document.getElementById('dis-btn').addEventListener('click', () => setAdvantage('disadvantage'));

  // Spell slots dropdown toggle
  document.getElementById('slots-header').addEventListener('click', () => {
    document.getElementById('slots-row').classList.toggle('open');
  });

  // Request character data from parent window
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ action: 'requestStatusData' }, '*');
  } else {
    document.getElementById('character-name').textContent = 'No parent';
  }
});

// Listen for messages from parent
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'updateStatusData') {
    characterData = event.data.data;
    updateDisplay();
  } else if (event.data && event.data.action === 'updateAdvantageState') {
    setAdvantageUI(event.data.state);
  }
});

function setAdvantage(state) {
  advantageState = state;
  setAdvantageUI(state);

  // Send to parent window
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ action: 'setAdvantageState', state: state }, '*');
  }
}

function setAdvantageUI(state) {
  advantageState = state;
  document.querySelectorAll('.adv-btn').forEach(btn => btn.classList.remove('active'));

  if (state === 'advantage') {
    document.getElementById('adv-btn').classList.add('active');
  } else if (state === 'disadvantage') {
    document.getElementById('dis-btn').classList.add('active');
  } else {
    document.getElementById('norm-btn').classList.add('active');
  }
}

function updateDisplay() {
  if (!characterData) return;

  // Character name
  document.getElementById('character-name').textContent = characterData.name || 'Unknown';

  updateHP();
  updateConcentration();
  updateSpellSlots();
  updateResources();
  updateEffects();
}

function updateHP() {
  const hp = characterData.hitPoints || characterData.hit_points || {};
  const current = hp.current || 0;
  const max = hp.max || 1;
  const tempHP = characterData.temporaryHP || hp.temp || 0;

  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  const hpFill = document.getElementById('hp-fill');
  const hpText = document.getElementById('hp-text');
  const tempHPEl = document.getElementById('temp-hp');

  hpFill.style.width = `${percentage}%`;
  hpText.textContent = `${current}/${max}`;

  hpFill.className = 'hp-fill';
  if (percentage <= 25) hpFill.classList.add('critical');
  else if (percentage <= 50) hpFill.classList.add('low');

  tempHPEl.textContent = tempHP > 0 ? `+${tempHP}` : '';
}

function updateConcentration() {
  const concEl = document.getElementById('concentration');
  const spellEl = document.getElementById('conc-spell');

  const spell = characterData.concentrationSpell || '';

  if (spell) {
    concEl.classList.remove('inactive');
    concEl.classList.add('active');
    spellEl.textContent = spell;
  } else {
    concEl.classList.remove('active');
    concEl.classList.add('inactive');
    spellEl.textContent = '—';
  }
}

function updateSpellSlots() {
  const spellSlots = characterData.spellSlots || {};
  const slotsRow = document.getElementById('slots-row');
  const dropdown = document.getElementById('slots-dropdown');
  const summary = document.getElementById('slots-summary');

  const slots = [];
  let totalCurrent = 0;
  let totalMax = 0;

  // Regular spell slots (levels 1-9)
  for (let level = 1; level <= 9; level++) {
    const current = spellSlots[`level${level}SpellSlots`] || 0;
    const max = spellSlots[`level${level}SpellSlotsMax`] || 0;

    if (max > 0) {
      slots.push({ level: level, current, max, type: 'regular' });
      totalCurrent += current;
      totalMax += max;
    }
  }

  // Pact Magic
  const pactCurrent = spellSlots.pactMagicSlots || 0;
  const pactMax = spellSlots.pactMagicSlotsMax || 0;
  const pactLevel = spellSlots.pactMagicLevel || 0;

  if (pactMax > 0) {
    slots.push({ level: `P${pactLevel}`, current: pactCurrent, max: pactMax, type: 'pact' });
    totalCurrent += pactCurrent;
    totalMax += pactMax;
  }

  if (slots.length === 0) {
    slotsRow.style.display = 'none';
    return;
  }

  slotsRow.style.display = 'block';
  summary.textContent = `${totalCurrent}/${totalMax}`;

  dropdown.innerHTML = slots.map(slot => `
    <div class="slot-item ${slot.type === 'pact' ? 'pact' : ''}">
      <span class="lvl">${slot.type === 'pact' ? 'Pact' : 'Lv' + slot.level}</span>
      <span class="val ${slot.current === 0 ? 'empty' : ''}">${slot.current}/${slot.max}</span>
    </div>
  `).join('');
}

function updateResources() {
  const resources = characterData.resources || [];
  const resourcesRow = document.getElementById('resources-row');
  const resourcesList = document.getElementById('resources-list');

  // Filter out HP, Lucky, and zero-max resources
  const filteredResources = resources.filter(r => {
    const name = (r.name || '').toLowerCase();
    return r.max > 0 && !name.includes('hit points') && !name.includes('lucky');
  });

  if (filteredResources.length === 0) {
    resourcesRow.style.display = 'none';
    return;
  }

  resourcesRow.style.display = 'block';
  resourcesList.innerHTML = filteredResources.slice(0, 4).map(r => `
    <div class="resource-item">
      <span class="name" title="${r.name}">${r.name}</span>
      <span class="val">${r.current}/${r.max}</span>
    </div>
  `).join('');
}

function updateEffects() {
  const buffs = characterData.activeBuffs || [];
  const debuffs = characterData.activeDebuffs || [];
  const effectsRow = document.getElementById('effects-row');

  const allEffects = [
    ...buffs.map(b => ({ name: typeof b === 'string' ? b : b.name, type: 'buff' })),
    ...debuffs.map(d => ({ name: typeof d === 'string' ? d : d.name, type: 'debuff' }))
  ];

  if (allEffects.length === 0) {
    effectsRow.innerHTML = '<span class="no-effects">No effects</span>';
    return;
  }

  effectsRow.innerHTML = allEffects.map(e => {
    const icon = EFFECT_ICONS[e.name] || (e.type === 'buff' ? '✨' : '💀');
    return `<span class="effect-badge" title="${e.name}">${icon}<span class="tooltip">${e.name}</span></span>`;
  }).join('');
}

// Request updates periodically
setInterval(() => {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ action: 'requestStatusData' }, '*');
  } else {
    window.close();
  }
}, 5000);
