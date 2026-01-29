/**
 * Compact Status Bar
 * Displays HP, concentration, buffs, and debuffs in a small window
 */

let characterData = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  debug.log('📊 Status bar loaded');

  // Close button
  document.getElementById('close-btn').addEventListener('click', () => {
    window.close();
  });

  // Request character data from parent window
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ action: 'requestStatusData' }, '*');
    debug.log('📊 Requested status data from parent');
  } else {
    debug.error('❌ No parent window available');
    document.getElementById('character-name').textContent = 'Error: No parent window';
  }
});

// Listen for character data updates from parent
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'updateStatusData') {
    characterData = event.data.data;
    debug.log('📊 Received status update:', characterData);
    updateDisplay();
  }
});

function updateDisplay() {
  if (!characterData) return;

  // Update character name
  const nameEl = document.getElementById('character-name');
  nameEl.textContent = characterData.name || 'Unknown';

  // Update HP
  updateHP();

  // Update concentration
  updateConcentration();

  // Update buffs and debuffs
  updateEffects();

  // Update spell slots
  updateSpellSlots();
}

function updateHP() {
  const hp = characterData.hitPoints || characterData.hit_points || {};
  const current = hp.current || 0;
  const max = hp.max || 1;
  const tempHP = hp.temp || hp.temporary || 0;

  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  // Update HP bar
  const hpFill = document.getElementById('hp-fill');
  const hpText = document.getElementById('hp-text');
  const tempHPEl = document.getElementById('temp-hp');

  hpFill.style.width = `${percentage}%`;
  hpText.textContent = `${current}/${max}`;

  // Color based on HP percentage
  hpFill.className = 'hp-fill';
  if (percentage <= 25) {
    hpFill.classList.add('critical');
  } else if (percentage <= 50) {
    hpFill.classList.add('low');
  }

  // Show temp HP if any
  if (tempHP > 0) {
    tempHPEl.textContent = `+${tempHP} temp`;
    tempHPEl.style.display = 'block';
  } else {
    tempHPEl.style.display = 'none';
  }
}

function updateConcentration() {
  const concentrationEl = document.getElementById('concentration');
  const spellEl = document.getElementById('concentration-spell');

  // Check if concentration is active
  const concentrating = characterData.concentrating || false;
  const concentrationSpell = characterData.concentrationSpell || '';

  if (concentrating && concentrationSpell) {
    concentrationEl.classList.remove('inactive');
    concentrationEl.classList.add('active');
    spellEl.textContent = concentrationSpell;
  } else {
    concentrationEl.classList.remove('active');
    concentrationEl.classList.add('inactive');
    spellEl.textContent = 'No concentration';
  }
}

function updateEffects() {
  const buffs = characterData.activeBuffs || [];
  const debuffs = characterData.activeDebuffs || [];

  // Update buffs
  const buffsSection = document.getElementById('buffs-section');
  const buffsList = document.getElementById('buffs-list');

  if (buffs.length > 0) {
    buffsSection.style.display = 'block';
    buffsList.innerHTML = buffs.map(buff => `
      <div class="effect-item buff">
        <span class="effect-icon">✨</span>
        <span class="effect-name">${buff.name || buff}</span>
        ${buff.duration ? `<span class="effect-duration">${buff.duration}</span>` : ''}
      </div>
    `).join('');
  } else {
    buffsSection.style.display = 'none';
  }

  // Update debuffs
  const debuffsSection = document.getElementById('debuffs-section');
  const debuffsList = document.getElementById('debuffs-list');

  if (debuffs.length > 0) {
    debuffsSection.style.display = 'block';
    debuffsList.innerHTML = debuffs.map(debuff => `
      <div class="effect-item debuff">
        <span class="effect-icon">💀</span>
        <span class="effect-name">${debuff.name || debuff}</span>
        ${debuff.duration ? `<span class="effect-duration">${debuff.duration}</span>` : ''}
      </div>
    `).join('');
  } else {
    debuffsSection.style.display = 'none';
  }
}

function updateSpellSlots() {
  const spellSlots = characterData.spellSlots || {};
  const container = document.getElementById('spell-slots-container');

  if (!spellSlots || Object.keys(spellSlots).length === 0) {
    document.getElementById('spell-slots-bar').style.display = 'none';
    return;
  }

  document.getElementById('spell-slots-bar').style.display = 'block';

  const slots = [];

  // Regular spell slots (levels 1-9)
  for (let level = 1; level <= 9; level++) {
    const current = spellSlots[`level${level}SpellSlots`] || 0;
    const max = spellSlots[`level${level}SpellSlotsMax`] || 0;

    if (max > 0) {
      slots.push({
        level: level,
        current: current,
        max: max,
        type: 'regular',
        label: `Level ${level}`
      });
    }
  }

  // Pact Magic slots
  const pactCurrent = spellSlots.pactMagicSlots || 0;
  const pactMax = spellSlots.pactMagicSlotsMax || 0;
  const pactLevel = spellSlots.pactMagicLevel || 0;

  if (pactMax > 0 && pactLevel > 0) {
    slots.push({
      level: `P${pactLevel}`,
      current: pactCurrent,
      max: pactMax,
      type: 'pact',
      label: `Pact Magic Level ${pactLevel}`
    });
  }

  // Render slot indicators
  container.innerHTML = slots.map(slot => {
    const hasSlots = slot.current > 0;
    const slotClass = slot.type === 'pact' ? 'slot-indicator pact-slots' : `slot-indicator ${hasSlots ? 'has-slots' : 'empty'}`;

    return `
      <div class="${slotClass}">
        ${slot.level}
        <div class="slot-tooltip">${slot.label}: ${slot.current}/${slot.max}</div>
      </div>
    `;
  }).join('');
}

// Request updates periodically (in case parent doesn't push updates)
setInterval(() => {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ action: 'requestStatusData' }, '*');
  } else {
    // Parent window closed, close this window too
    window.close();
  }
}, 5000);
