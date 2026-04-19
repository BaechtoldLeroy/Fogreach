// js/skillSystem.js - Skill Tree System

if (!window.playerSkills) {
  window.playerSkills = {};
}

const SKILL_TREES = {
  combat: {
    id: 'combat',
    name: 'Kampf',
    color: '#ff4444',
    skills: [
      {
        id: 'combat_damage_1',
        name: 'Eiserne Klinge I',
        description: '+2 Waffenschaden',
        cost: 5,
        requires: [],
        tier: 1,
        effect: { weaponDamage: 2 }
      },
      {
        id: 'combat_damage_2',
        name: 'Eiserne Klinge II',
        description: '+4 Waffenschaden',
        cost: 10,
        requires: ['combat_damage_1'],
        tier: 2,
        effect: { weaponDamage: 4 }
      },
      {
        id: 'combat_damage_3',
        name: 'Meisterklinge',
        description: '+8 Waffenschaden',
        cost: 20,
        requires: ['combat_damage_2'],
        tier: 3,
        effect: { weaponDamage: 8 }
      },
      {
        id: 'combat_crit_1',
        name: 'Präzision I',
        description: '+5% kritische Trefferchance',
        cost: 8,
        requires: ['combat_damage_1'],
        tier: 2,
        effect: { playerCritChance: 0.05 }
      },
      {
        id: 'combat_crit_2',
        name: 'Präzision II',
        description: '+10% kritische Trefferchance',
        cost: 15,
        requires: ['combat_crit_1', 'combat_damage_2'],
        tier: 3,
        effect: { playerCritChance: 0.10 }
      },
      {
        id: 'combat_speed_1',
        name: 'Schnelle Schläge I',
        description: '+0.2 Angriffsgeschwindigkeit',
        cost: 7,
        requires: ['combat_damage_1'],
        tier: 2,
        effect: { weaponAttackSpeed: 0.2 }
      },
      {
        id: 'combat_speed_2',
        name: 'Schnelle Schläge II',
        description: '+0.3 Angriffsgeschwindigkeit',
        cost: 12,
        requires: ['combat_speed_1'],
        tier: 3,
        effect: { weaponAttackSpeed: 0.3 }
      },
      {
        id: 'combat_range_1',
        name: 'Erweiterte Reichweite',
        description: '+20 Angriffsreichweite',
        cost: 6,
        requires: ['combat_damage_1'],
        tier: 2,
        effect: { attackRange: 20 }
      },
      {
        id: 'combat_poison_blade',
        name: 'Giftklinge',
        description: 'Nahkampfangriffe haben 20% Chance, Gift anzuwenden',
        cost: 8,
        requires: ['combat_damage_1'],
        tier: 2,
        effect: {},
        isActive: true,
        activeType: 'poisonBlade'
      },
      {
        id: 'combat_chain_lightning',
        name: 'Kettenblitz',
        description: 'Wirbelangriff trifft 1 zusätzlichen Gegner in der Nähe (50% Schaden)',
        cost: 12,
        requires: ['combat_speed_1', 'combat_damage_2'],
        tier: 3,
        effect: {},
        isActive: true,
        activeType: 'chainLightning'
      },
      {
        id: 'combat_lethal_thrust',
        name: 'Tödlicher Stoß',
        description: 'Aufgeladener Schlag: +25% kritische Trefferchance',
        cost: 15,
        requires: ['combat_crit_1', 'combat_damage_2'],
        tier: 3,
        effect: {},
        isActive: true,
        activeType: 'lethalThrust'
      }
    ]
  },
  survival: {
    id: 'survival',
    name: 'Überleben',
    color: '#44ff44',
    skills: [
      {
        id: 'survival_hp_1',
        name: 'Zähigkeit I',
        description: '+10 maximale Gesundheit',
        cost: 5,
        requires: [],
        tier: 1,
        effect: { playerMaxHealth: 10 }
      },
      {
        id: 'survival_hp_2',
        name: 'Zähigkeit II',
        description: '+20 maximale Gesundheit',
        cost: 10,
        requires: ['survival_hp_1'],
        tier: 2,
        effect: { playerMaxHealth: 20 }
      },
      {
        id: 'survival_hp_3',
        name: 'Eiserner Wille',
        description: '+40 maximale Gesundheit',
        cost: 20,
        requires: ['survival_hp_2'],
        tier: 3,
        effect: { playerMaxHealth: 40 }
      },
      {
        id: 'survival_armor_1',
        name: 'Dicke Haut I',
        description: '+5% Rüstung',
        cost: 8,
        requires: ['survival_hp_1'],
        tier: 2,
        effect: { playerArmor: 0.05 }
      },
      {
        id: 'survival_armor_2',
        name: 'Dicke Haut II',
        description: '+10% Rüstung',
        cost: 15,
        requires: ['survival_armor_1', 'survival_hp_2'],
        tier: 3,
        effect: { playerArmor: 0.10 }
      },
      {
        id: 'survival_regen_1',
        name: 'Regeneration I',
        description: 'Heilt 1 HP alle 5 Sekunden im Hub',
        cost: 10,
        requires: ['survival_hp_1'],
        tier: 2,
        effect: { healthRegen: 0.2 }
      },
      {
        id: 'survival_regen_2',
        name: 'Regeneration II',
        description: 'Heilt 2 HP alle 5 Sekunden im Hub',
        cost: 18,
        requires: ['survival_regen_1'],
        tier: 3,
        effect: { healthRegen: 0.4 }
      },
      {
        id: 'survival_thorn_armor',
        name: 'Dornenrüstung',
        description: 'Nahkampfangreifer erleiden 2 Schaden zurück',
        cost: 10,
        requires: ['survival_armor_1'],
        tier: 2,
        effect: {},
        isActive: true,
        activeType: 'thornArmor'
      },
      {
        id: 'survival_second_chance',
        name: 'Zweite Chance',
        description: 'Einmal pro Dungeon: Bei Tod mit 30% HP wiederbeleben',
        cost: 20,
        requires: ['survival_hp_2', 'survival_armor_1'],
        tier: 3,
        effect: {},
        isActive: true,
        activeType: 'secondChance'
      },
      {
        id: 'survival_life_steal',
        name: 'Lebensraub',
        description: '10% des verursachten Schadens heilt den Spieler',
        cost: 12,
        requires: ['survival_hp_1', 'survival_regen_1'],
        tier: 3,
        effect: {},
        isActive: true,
        activeType: 'lifeSteal'
      }
    ]
  },
  mobility: {
    id: 'mobility',
    name: 'Mobilität',
    color: '#4444ff',
    skills: [
      {
        id: 'mobility_speed_1',
        name: 'Flinke Füße I',
        description: '+10 Bewegungsgeschwindigkeit',
        cost: 5,
        requires: [],
        tier: 1,
        effect: { playerSpeed: 10 }
      },
      {
        id: 'mobility_speed_2',
        name: 'Flinke Füße II',
        description: '+20 Bewegungsgeschwindigkeit',
        cost: 10,
        requires: ['mobility_speed_1'],
        tier: 2,
        effect: { playerSpeed: 20 }
      },
      {
        id: 'mobility_speed_3',
        name: 'Windläufer',
        description: '+35 Bewegungsgeschwindigkeit',
        cost: 20,
        requires: ['mobility_speed_2'],
        tier: 3,
        effect: { playerSpeed: 35 }
      },
      {
        id: 'mobility_dodge_1',
        name: 'Ausweichen I',
        description: '5% Chance Schaden zu vermeiden',
        cost: 12,
        requires: ['mobility_speed_1'],
        tier: 2,
        effect: { dodgeChance: 0.05 }
      },
      {
        id: 'mobility_dodge_2',
        name: 'Ausweichen II',
        description: '10% Chance Schaden zu vermeiden',
        cost: 20,
        requires: ['mobility_dodge_1', 'mobility_speed_2'],
        tier: 3,
        effect: { dodgeChance: 0.10 }
      },
      {
        id: 'mobility_shadow_step',
        name: 'Schattensprung',
        description: 'Sturmangriff-Distanz +50%',
        cost: 10,
        requires: ['mobility_speed_2'],
        tier: 2,
        effect: {},
        isActive: true,
        activeType: 'shadowStep'
      },
      {
        id: 'mobility_wind_gust',
        name: 'Windstoß',
        description: 'Dolchwurf durchdringt den ersten Gegner',
        cost: 8,
        requires: ['mobility_speed_1'],
        tier: 2,
        effect: {},
        isActive: true,
        activeType: 'windGust'
      },
      {
        id: 'mobility_lightning_reflex',
        name: 'Blitzreflex',
        description: 'Ausweichen gewährt 0.5s Unverwundbarkeit',
        cost: 15,
        requires: ['mobility_dodge_1', 'mobility_speed_2'],
        tier: 3,
        effect: {},
        isActive: true,
        activeType: 'lightningReflex'
      }
    ]
  }
};

// ---------- i18n bootstrap ----------
// Auto-register German strings from SKILL_TREES, then convert each tree.name +
// skill.name + skill.description to a getter so existing consumers (skill-tree
// UI, tooltips) automatically see the active language.
if (window.i18n) {
  var _autoSkillDe = {};
  Object.keys(SKILL_TREES).forEach(function (treeId) {
    var tree = SKILL_TREES[treeId];
    if (typeof tree.name === 'string') _autoSkillDe['skill.tree.' + treeId + '.name'] = tree.name;
    (tree.skills || []).forEach(function (s) {
      if (typeof s.name === 'string') _autoSkillDe['skill.' + s.id + '.name'] = s.name;
      if (typeof s.description === 'string') _autoSkillDe['skill.' + s.id + '.description'] = s.description;
    });
  });
  window.i18n.register('de', _autoSkillDe);

  window.i18n.register('en', {
    'skill.tree.combat.name': 'Combat',
    'skill.combat_damage_1.name': 'Iron Blade I',
    'skill.combat_damage_1.description': '+2 weapon damage',
    'skill.combat_damage_2.name': 'Iron Blade II',
    'skill.combat_damage_2.description': '+4 weapon damage',
    'skill.combat_damage_3.name': 'Master Blade',
    'skill.combat_damage_3.description': '+8 weapon damage',
    'skill.combat_crit_1.name': 'Precision I',
    'skill.combat_crit_1.description': '+5% critical hit chance',
    'skill.combat_crit_2.name': 'Precision II',
    'skill.combat_crit_2.description': '+10% critical hit chance',
    'skill.combat_speed_1.name': 'Quick Strikes I',
    'skill.combat_speed_1.description': '+0.2 attack speed',
    'skill.combat_speed_2.name': 'Quick Strikes II',
    'skill.combat_speed_2.description': '+0.3 attack speed',
    'skill.combat_range_1.name': 'Extended Reach',
    'skill.combat_range_1.description': '+20 attack range',
    'skill.combat_poison_blade.name': 'Poison Blade',
    'skill.combat_poison_blade.description': 'Melee attacks have a 20% chance to apply poison',
    'skill.combat_chain_lightning.name': 'Chain Lightning',
    'skill.combat_chain_lightning.description': 'Spin attack hits 1 additional nearby enemy (50% damage)',
    'skill.combat_lethal_thrust.name': 'Lethal Thrust',
    'skill.combat_lethal_thrust.description': 'Charged Slash: +25% critical hit chance',

    'skill.tree.survival.name': 'Survival',
    'skill.survival_hp_1.name': 'Toughness I',
    'skill.survival_hp_1.description': '+10 maximum health',
    'skill.survival_hp_2.name': 'Toughness II',
    'skill.survival_hp_2.description': '+20 maximum health',
    'skill.survival_hp_3.name': 'Iron Will',
    'skill.survival_hp_3.description': '+40 maximum health',
    'skill.survival_armor_1.name': 'Thick Skin I',
    'skill.survival_armor_1.description': '+5% armor',
    'skill.survival_armor_2.name': 'Thick Skin II',
    'skill.survival_armor_2.description': '+10% armor',
    'skill.survival_regen_1.name': 'Regeneration I',
    'skill.survival_regen_1.description': 'Heals 1 HP every 5 seconds in the hub',
    'skill.survival_regen_2.name': 'Regeneration II',
    'skill.survival_regen_2.description': 'Heals 2 HP every 5 seconds in the hub',
    'skill.survival_thorn_armor.name': 'Thorn Armor',
    'skill.survival_thorn_armor.description': 'Melee attackers take 2 damage back',
    'skill.survival_second_chance.name': 'Second Chance',
    'skill.survival_second_chance.description': 'Once per dungeon: revive at 30% HP on death',
    'skill.survival_life_steal.name': 'Life Steal',
    'skill.survival_life_steal.description': '10% of damage dealt heals the player',

    'skill.tree.mobility.name': 'Mobility',
    'skill.mobility_speed_1.name': 'Swift Feet I',
    'skill.mobility_speed_1.description': '+10 movement speed',
    'skill.mobility_speed_2.name': 'Swift Feet II',
    'skill.mobility_speed_2.description': '+20 movement speed',
    'skill.mobility_speed_3.name': 'Wind Walker',
    'skill.mobility_speed_3.description': '+35 movement speed',
    'skill.mobility_dodge_1.name': 'Dodge I',
    'skill.mobility_dodge_1.description': '5% chance to avoid damage',
    'skill.mobility_dodge_2.name': 'Dodge II',
    'skill.mobility_dodge_2.description': '10% chance to avoid damage',
    'skill.mobility_shadow_step.name': 'Shadow Leap',
    'skill.mobility_shadow_step.description': 'Dash Slash distance +50%',
    'skill.mobility_wind_gust.name': 'Wind Gust',
    'skill.mobility_wind_gust.description': 'Dagger Throw pierces the first enemy',
    'skill.mobility_lightning_reflex.name': 'Lightning Reflex',
    'skill.mobility_lightning_reflex.description': 'Dodge grants 0.5s of invulnerability'
  });

  // Convert value-properties to getters for live language switching.
  Object.keys(SKILL_TREES).forEach(function (treeId) {
    var tree = SKILL_TREES[treeId];
    var treeNameKey = 'skill.tree.' + treeId + '.name';
    try {
      Object.defineProperty(tree, 'name', {
        get: function () {
          var v = window.i18n.t(treeNameKey);
          return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : treeId;
        },
        configurable: true, enumerable: true
      });
    } catch (e) { /* swallow */ }
    (tree.skills || []).forEach(function (s) {
      var nameKey = 'skill.' + s.id + '.name';
      var descKey = 'skill.' + s.id + '.description';
      try {
        Object.defineProperty(s, 'name', {
          get: function () {
            var v = window.i18n.t(nameKey);
            return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : s.id;
          },
          configurable: true, enumerable: true
        });
        Object.defineProperty(s, 'description', {
          get: function () {
            var v = window.i18n.t(descKey);
            return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : '';
          },
          configurable: true, enumerable: true
        });
      } catch (e) { /* swallow */ }
    });
  });
}

function hasSkill(skillId) {
  return !!window.playerSkills[skillId];
}

function getSkillById(skillId) {
  for (const tree of Object.values(SKILL_TREES)) {
    const skill = tree.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
}

function canPurchaseSkill(skillId) {
  const skill = getSkillById(skillId);
  if (!skill) return { canPurchase: false, reason: 'Skill nicht gefunden' };
  
  if (hasSkill(skillId)) {
    return { canPurchase: false, reason: 'Bereits erlernt' };
  }
  
  for (const reqId of skill.requires) {
    if (!hasSkill(reqId)) {
      const reqSkill = getSkillById(reqId);
      const reqName = reqSkill ? reqSkill.name : reqId;
      return { canPurchase: false, reason: `Benötigt: ${reqName}` };
    }
  }
  
  const currentMaterials = typeof getMaterialCount === 'function' 
    ? getMaterialCount('MAT') 
    : (window.materialCounts?.MAT || 0);
  
  if (currentMaterials < skill.cost) {
    return { canPurchase: false, reason: `Nicht genug Eisenbrocken (${currentMaterials}/${skill.cost})` };
  }
  
  return { canPurchase: true };
}

function purchaseSkill(skillId) {
  // Endless mode disables the normal skill-tree purchase path. Skills can
  // only be acquired via the upgrade-card pick after each cleared room.
  if (window.__ENDLESS_MODE__) {
    return { success: false, reason: 'Im Endlos-Modus deaktiviert' };
  }
  const checkResult = canPurchaseSkill(skillId);
  if (!checkResult.canPurchase) {
    return { success: false, reason: checkResult.reason };
  }
  
  const skill = getSkillById(skillId);
  if (!skill) {
    return { success: false, reason: 'Skill nicht gefunden' };
  }
  
  const spendSuccess = typeof spendMaterialFromStorage === 'function' 
    ? spendMaterialFromStorage('MAT', skill.cost)
    : false;
  
  if (!spendSuccess) {
    return { success: false, reason: 'Fehler beim Ausgeben der Eisenbrocken' };
  }
  
  window.playerSkills[skillId] = true;
  
  applySkillEffects();
  
  if (typeof saveGame === 'function') {
    saveGame();
  }
  
  return { success: true, skill };
}

function calculateSkillEffects() {
  const effects = {
    weaponDamage: 0,
    weaponAttackSpeed: 0,
    attackRange: 0,
    playerMaxHealth: 0,
    playerArmor: 0,
    playerSpeed: 0,
    playerCritChance: 0,
    dodgeChance: 0,
    healthRegen: 0
  };
  
  for (const skillId of Object.keys(window.playerSkills || {})) {
    const skill = getSkillById(skillId);
    if (!skill || !skill.effect) continue;
    
    for (const [stat, value] of Object.entries(skill.effect)) {
      effects[stat] = (effects[stat] || 0) + value;
    }
  }
  
  return effects;
}

function applySkillEffects() {
  const effects = calculateSkillEffects();
  
  if (typeof window !== 'undefined') {
    window.SKILL_BONUSES = effects;
    
    if (typeof weaponDamage !== 'undefined') {
      weaponDamage = (window.BASE_WEAPON_DAMAGE || 5) + effects.weaponDamage;
    }
    if (typeof weaponAttackSpeed !== 'undefined') {
      weaponAttackSpeed = (window.BASE_WEAPON_ATTACK_SPEED || 1) + effects.weaponAttackSpeed;
    }
    if (typeof attackRange !== 'undefined') {
      attackRange = (window.BASE_ATTACK_RANGE || 80) + effects.attackRange;
    }
    if (typeof playerMaxHealth !== 'undefined') {
      const oldMax = playerMaxHealth;
      if (!window.BASE_PLAYER_MAX_HEALTH) {
        window.BASE_PLAYER_MAX_HEALTH = (typeof baseStats !== 'undefined' && baseStats.maxHP) || 30;
      }
      const baseHP = window.BASE_PLAYER_MAX_HEALTH;
      playerMaxHealth = baseHP + effects.playerMaxHealth;
      console.log('[Skills] Applying health:', {
        baseHP,
        bonus: effects.playerMaxHealth,
        oldMax,
        newMax: playerMaxHealth
      });
      if (typeof playerHealth !== 'undefined') {
        const healthPercent = oldMax > 0 ? playerHealth / oldMax : 1;
        playerHealth = Math.min(playerHealth, playerMaxHealth);
        if (healthPercent === 1) {
          playerHealth = playerMaxHealth;
        }
      }
    }
    if (typeof playerArmor !== 'undefined') {
      playerArmor = Math.min(0.75, (window.BASE_PLAYER_ARMOR || 0) + effects.playerArmor);
    }
    if (typeof playerSpeed !== 'undefined') {
      playerSpeed = (window.BASE_PLAYER_SPEED || 220) + effects.playerSpeed;
    }
    if (typeof playerCritChance !== 'undefined') {
      playerCritChance = Math.min(1, (window.BASE_PLAYER_CRIT_CHANCE || 0.05) + effects.playerCritChance);
    }
    
    window.PLAYER_DODGE_CHANCE = effects.dodgeChance > 0 ? Math.min(0.5, effects.dodgeChance) : 0;
    window.PLAYER_HEALTH_REGEN = effects.healthRegen > 0 ? effects.healthRegen : 0;
  }
  
  return effects;
}

function resetSkills() {
  window.playerSkills = {};
  applySkillEffects();
}

function respecSkills() {
  const totalSpent = getSkillPointsSpent();
  if (totalSpent === 0) {
    return { success: false, reason: 'Keine Fähigkeiten zum Zurücksetzen' };
  }

  const respecCost = Math.ceil(totalSpent * 0.5);
  const currentMaterials = typeof getMaterialCount === 'function'
    ? getMaterialCount('MAT')
    : (window.materialCounts?.MAT || 0);

  if (currentMaterials < respecCost) {
    return { success: false, reason: `Nicht genug Eisenbrocken (${currentMaterials}/${respecCost})` };
  }

  // Deduct respec cost
  const spendSuccess = typeof spendMaterialFromStorage === 'function'
    ? spendMaterialFromStorage('MAT', respecCost)
    : false;

  if (!spendSuccess) {
    return { success: false, reason: 'Fehler beim Ausgeben der Eisenbrocken' };
  }

  // Refund spent materials minus respec cost
  const refund = totalSpent - respecCost;
  if (refund > 0 && typeof changeMaterialCount === 'function') {
    changeMaterialCount('MAT', refund);
    if (typeof updateMaterialCounterUI === 'function') updateMaterialCounterUI();
  }

  // Reset all skills
  window.playerSkills = {};
  window._secondChanceUsed = false;
  applySkillEffects();

  if (typeof saveGame === 'function') {
    saveGame();
  }

  return { success: true, refunded: refund, cost: respecCost };
}

function getSkillPointsSpent() {
  let total = 0;
  for (const skillId of Object.keys(window.playerSkills)) {
    const skill = getSkillById(skillId);
    if (skill) total += skill.cost;
  }
  return total;
}

function getSkillTreeStats() {
  const stats = {};
  for (const [treeId, tree] of Object.entries(SKILL_TREES)) {
    let learned = 0;
    let total = tree.skills.length;
    for (const skill of tree.skills) {
      if (hasSkill(skill.id)) learned++;
    }
    stats[treeId] = { learned, total, name: tree.name };
  }
  return stats;
}

window.SKILL_TREES = SKILL_TREES;
window.hasSkill = hasSkill;
window.getSkillById = getSkillById;
window.canPurchaseSkill = canPurchaseSkill;
window.purchaseSkill = purchaseSkill;
window.calculateSkillEffects = calculateSkillEffects;
window.applySkillEffects = applySkillEffects;
window.resetSkills = resetSkills;
window.respecSkills = respecSkills;
window.getSkillPointsSpent = getSkillPointsSpent;
window.getSkillTreeStats = getSkillTreeStats;
