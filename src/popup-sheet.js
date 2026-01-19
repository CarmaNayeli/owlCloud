console.log('✅ Popup HTML loaded');

// Listen for character data from parent window via postMessage
window.addEventListener('message', (event) => {
  console.log('✅ Received message in popup:', event.data);

  if (event.data && event.data.action === 'initCharacterSheet') {
    console.log('✅ Initializing character sheet with data:', event.data.data.name);
    buildSheet(event.data.data);
  }
});

console.log('✅ Waiting for character data via postMessage...');

function buildSheet(data) {
  console.log('Building character sheet...');

  // Character name and info
  document.getElementById('char-name').textContent = `🎲 ${data.name || 'Character'}`;
  document.getElementById('char-info').innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
      <div><strong>Class:</strong> ${data.class || 'Unknown'}</div>
      <div><strong>Level:</strong> ${data.level || 1}</div>
      <div><strong>Race:</strong> ${data.race || 'Unknown'}</div>
    </div>
  `;

  // Abilities
  const abilitiesGrid = document.getElementById('abilities-grid');
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  abilities.forEach(ability => {
    const score = data.attributes?.[ability] || 10;
    const mod = data.attributeMods?.[ability] || 0;
    const card = createCard(ability.substring(0, 3).toUpperCase(), score, `+${mod}`, () => {
      roll(`${ability.charAt(0).toUpperCase() + ability.slice(1)}`, `1d20+${mod}`);
    });
    abilitiesGrid.appendChild(card);
  });

  // Saves
  const savesGrid = document.getElementById('saves-grid');
  abilities.forEach(ability => {
    const bonus = data.savingThrows?.[ability] || 0;
    const card = createCard(`${ability.substring(0, 3).toUpperCase()}`, `+${bonus}`, '', () => {
      roll(`${ability.toUpperCase()} Save`, `1d20+${bonus}`);
    });
    savesGrid.appendChild(card);
  });

  // Skills
  const skillsGrid = document.getElementById('skills-grid');
  Object.entries(data.skills || {}).forEach(([skill, bonus]) => {
    const displayName = skill.charAt(0).toUpperCase() + skill.slice(1).replace(/-/g, ' ');
    const card = createCard(displayName, `${bonus >= 0 ? '+' : ''}${bonus}`, '', () => {
      roll(displayName, `1d20${bonus >= 0 ? '+' : ''}${bonus}`);
    });
    skillsGrid.appendChild(card);
  });

  // Spells
  const spellsContainer = document.getElementById('spells-container');
  if (data.spells && data.spells.length > 0) {
    data.spells.forEach((spell, index) => {
      const spellCard = createSpellCard(spell, index);
      spellsContainer.appendChild(spellCard);
    });
  } else {
    spellsContainer.innerHTML = '<p style="text-align: center; color: #666;">No spells available</p>';
  }

  console.log('✅ Sheet built successfully');
}

function createCard(title, main, sub, onClick) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <strong>${title}</strong><br>
    <span class="bonus">${main}</span><br>
    ${sub ? `<span class="bonus">${sub}</span>` : ''}
  `;
  card.addEventListener('click', onClick);
  return card;
}

function createSpellCard(spell, index) {
  const card = document.createElement('div');
  card.className = 'spell-card';

  const header = document.createElement('div');
  header.className = 'spell-header';
  header.innerHTML = `
    <div>
      <span style="font-weight: bold;">${spell.name}</span>
      ${spell.level ? `<span style="margin-left: 10px; color: #666;">Level ${spell.level}</span>` : ''}
    </div>
    <button class="toggle-btn">▼ Details</button>
  `;

  const desc = document.createElement('div');
  desc.className = 'spell-description';
  desc.id = `spell-desc-${index}`;
  desc.innerHTML = `
    ${spell.castingTime ? `<div><strong>Casting Time:</strong> ${spell.castingTime}</div>` : ''}
    ${spell.range ? `<div><strong>Range:</strong> ${spell.range}</div>` : ''}
    ${spell.duration ? `<div><strong>Duration:</strong> ${spell.duration}</div>` : ''}
    ${spell.school ? `<div><strong>School:</strong> ${spell.school}</div>` : ''}
    ${spell.description ? `<div style="margin-top: 10px;">${spell.description}</div>` : ''}
    ${spell.formula ? `<button class="roll-btn">🎲 Roll ${spell.formula}</button>` : ''}
  `;

  // Toggle functionality
  const toggleBtn = header.querySelector('.toggle-btn');
  header.addEventListener('click', (e) => {
    if (!e.target.classList.contains('roll-btn')) {
      desc.classList.toggle('expanded');
      toggleBtn.textContent = desc.classList.contains('expanded') ? '▲ Hide' : '▼ Details';
    }
  });

  // Roll button
  const rollBtn = desc.querySelector('.roll-btn');
  if (rollBtn && spell.formula) {
    rollBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      roll(spell.name, spell.formula);
    });
  }

  card.appendChild(header);
  card.appendChild(desc);
  return card;
}

function roll(name, formula) {
  console.log('🎲 Rolling:', name, formula);

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'rollFromPopout',
      name: name,
      formula: formula
    }, '*');

    showNotification(`🎲 Rolling ${name}...`);
  } else {
    alert('Parent window not available');
  }
}

function showNotification(message) {
  const notif = document.createElement('div');
  notif.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #27AE60; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;';
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 2000);
}

console.log('✅ Popup script fully loaded');
