// Thornroad — core rules engine (stats, dice, combat, luck, charm, inventory, saves)
// No UI code here — ui.js drives this through the exported Engine API.

(function (global) {
  'use strict';

  // ---------- seeded RNG (mulberry32) ----------
  function makeRNG(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFromString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h ^ (h >>> 16)) >>> 0;
  }

  const SPELL_DEFS = {
    leap:      { name: 'Leap',      verb: 'cast Leap',      desc: 'Carries you over an obstacle for a short while.' },
    swim:      { name: 'Current',   verb: 'cast Current',   desc: 'Lets you cross open water safely.' },
    flame:     { name: 'Flame',     verb: 'cast Flame',     desc: 'Hurls fire at a foe, wounding it at once.' },
    illusion:  { name: 'Seeming',   verb: 'cast Seeming',   desc: 'Shows a foe a lie convincing enough to walk away from.' },
    quick:     { name: 'Quicken',   verb: 'cast Quicken',   desc: 'Sharpens your Skill for one fight (+2).' },
    weaken:    { name: 'Falter',    verb: 'cast Falter',    desc: "Dulls a foe's Skill for one fight (-2)." },
    mirror:    { name: 'Twin',      verb: 'cast Twin',      desc: 'Conjures a double of a foe to fight in your place.' },
    mend:      { name: 'Mend',      verb: 'cast Mend',      desc: 'Restores 8 Stamina (never above your start).' }
  };

  function statRow(sum) {
    // Own balance table (2d6 sum -> Skill, Stamina, Charm). Not derived from any source text.
    // Stamina raised ~15-20% over the original vertical-slice numbers so an unlucky run
    // isn't a near-certain death sentence; Skill spread left as-is.
    const T = {
      2:  [7, 24, 8], 3:  [9, 22, 6], 4:  [11, 18, 5], 5:  [8, 20, 8],
      6:  [10, 23, 6], 7: [8, 23, 7], 8:  [9, 19, 7], 9:  [7, 27, 7],
      10: [8, 25, 6], 11: [9, 21, 7], 12: [10, 23, 5]
    };
    return T[sum];
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function Engine() {
    this.rng = makeRNG(Date.now() >>> 0);
    this.state = null;
    this.meta = null; // cross-run persistent memory ("the wood remembers")
  }

  Engine.prototype.setSeed = function (seed) {
    const n = typeof seed === 'number' ? seed >>> 0 : seedFromString(String(seed));
    this.rng = makeRNG(n);
    this.seedLabel = String(seed);
  };

  Engine.prototype.rollDie = function () { return 1 + Math.floor(this.rng() * 6); };
  Engine.prototype.roll2 = function () { return this.rollDie() + this.rollDie(); };
  // Same two rolls as roll2(), but also hands back the individual faces so the
  // UI can animate a real pair of dice landing on the true result.
  Engine.prototype.roll2Faces = function () { const a = this.rollDie(), b = this.rollDie(); return { a, b, sum: a + b }; };
  // Same roll as roll2Power(), but also hands back the raw die face for the
  // combat-roll dice animation.
  Engine.prototype.roll2PowerFace = function (skill) { const die = this.rollDie(); return { die, power: die * 2 + skill }; };

  Engine.prototype.loadMeta = function () {
    try {
      const raw = localStorage.getItem('thornroad.meta');
      this.meta = raw ? JSON.parse(raw) : { flags: {}, beaten: false, deaths: 0, runs: 0 };
    } catch (e) { this.meta = { flags: {}, beaten: false, deaths: 0, runs: 0 }; }
    return this.meta;
  };
  Engine.prototype.saveMeta = function () {
    try { localStorage.setItem('thornroad.meta', JSON.stringify(this.meta)); } catch (e) {}
  };

  Engine.prototype.rollNewCharacter = function () {
    const { a, b, sum } = this.roll2Faces();
    const [skill, stamina, charm] = statRow(sum);
    return { skill, stamina, charm, sum, diceA: a, diceB: b };
  };

  Engine.prototype.newGame = function (stats, spellLoadout) {
    if (!this.meta) this.loadMeta();
    this.meta.runs = (this.meta.runs || 0) + 1;
    this.saveMeta();

    const spellbook = {};
    Object.keys(SPELL_DEFS).forEach(k => spellbook[k] = 0);
    Object.keys(spellLoadout || {}).forEach(k => { if (spellbook.hasOwnProperty(k)) spellbook[k] = spellLoadout[k]; });

    this.state = {
      nodeId: 'n1',
      skill: stats.skill, maxSkill: stats.skill,
      stamina: stats.stamina, maxStamina: stats.stamina,
      charm: stats.charm, baseCharm: stats.charm,
      charmChecksDisabled: false,
      luck: [false, false, false, false, false, false], // true = crossed out (used)
      coins: 15,
      flask: 2,
      pack: [ { id: 'rations', name: 'Trail rations', slots: 1, qty: 3 } ],
      packLimit: 7,
      spellbook: spellbook,
      flags: {},
      journal: [],
      combat: null,
      history: [],
      turn: 0,
      dead: false,
      ended: null
    };
    // seed initial luck: cross out two random boxes, as fortune already spent before the road
    for (let i = 0; i < 2; i++) {
      const box = this.rollDie() - 1;
      this.state.luck[box] = true;
    }
    this.log('You set out from Fenhollow keep, sword at your hip and the Hush ahead of you.');
    return this.state;
  };

  Engine.prototype.log = function (text) {
    this.state.journal.push(text);
  };

  Engine.prototype.usedSlots = function () {
    return this.state.pack.reduce((n, it) => n + it.slots, 0);
  };

  Engine.prototype.addItem = function (item) {
    const s = this.state;
    const existing = s.pack.find(i => i.id === item.id);
    if (existing && item.stackable) { existing.qty = (existing.qty || 1) + (item.qty || 1); return true; }
    if (this.usedSlots() + item.slots > s.packLimit) return false;
    s.pack.push(clone(item));
    return true;
  };
  Engine.prototype.hasItem = function (id) { return this.state.pack.some(i => i.id === id); };
  Engine.prototype.removeItem = function (id) {
    const s = this.state;
    const idx = s.pack.findIndex(i => i.id === id);
    if (idx === -1) return false;
    if (s.pack[idx].qty && s.pack[idx].qty > 1) s.pack[idx].qty -= 1;
    else s.pack.splice(idx, 1);
    return true;
  };

  Engine.prototype.damageStamina = function (n) {
    this.state.stamina = Math.max(0, this.state.stamina - n);
    if (this.state.stamina <= 0) this.state.dead = true;
  };
  Engine.prototype.healStamina = function (n) {
    this.state.stamina = Math.min(this.state.maxStamina, this.state.stamina + n);
  };

  Engine.prototype.eatRation = function () {
    const s = this.state;
    const r = s.pack.find(i => i.id === 'rations');
    if (!r || r.qty <= 0) return false;
    r.qty -= 1;
    if (r.qty <= 0) s.pack = s.pack.filter(i => i.id !== 'rations');
    this.healStamina(4);
    this.log('You eat a ration (+4 Stamina).');
    return true;
  };
  Engine.prototype.drinkFlask = function () {
    const s = this.state;
    if (s.flask <= 0) return false;
    s.flask -= 1;
    this.healStamina(2);
    this.log('You drink from your flask (+2 Stamina).');
    return true;
  };

  Engine.prototype.castOutOfCombat = function (spellId) {
    const s = this.state;
    if (!s.spellbook[spellId] || s.spellbook[spellId] <= 0) return false;
    if (spellId === 'mend') {
      s.spellbook.mend -= 1;
      this.healStamina(8);
      this.log('You cast Mend (+8 Stamina).');
      return true;
    }
    return false;
  };

  // ---- luck ----
  Engine.prototype.checkLuck = function () {
    const roll = this.rollDie();
    const idx = roll - 1;
    const lucky = !this.state.luck[idx];
    this.state.luck[idx] = true;
    return { roll, lucky };
  };
  Engine.prototype.recoverLuckBox = function () {
    const roll = this.rollDie();
    const idx = roll - 1;
    const recovered = this.state.luck[idx];
    this.state.luck[idx] = false;
    return { roll, recovered };
  };

  // ---- charm ----
  Engine.prototype.checkCharm = function () {
    const { a, b, sum: roll } = this.roll2Faces();
    const success = roll <= this.state.charm;
    if (success) { this.state.charm = Math.min(12, this.state.charm + 1); }
    else { this.state.charm = Math.max(1, this.state.charm - 1); }
    return { roll, success, charm: this.state.charm, diceA: a, diceB: b };
  };

  // ---- combat ----
  Engine.prototype.startCombat = function (def) {
    const enemies = def.enemies.map((e, i) => ({
      id: 'e' + i,
      name: e.name,
      skill: e.skill,
      stamina: e.stamina,
      maxStamina: e.stamina,
      loyalty: (typeof e.loyalty === 'number') ? e.loyalty : null,
      parryStreak: 0,
      dmg: e.dmg || 2,
      fled: false,
      dead: false,
      skillMod: 0
    }));
    this.state.combat = {
      enemies,
      allowSpells: def.allowSpells || [],
      allowFlee: def.allowFlee || null,
      groundPenalty: def.groundPenalty || 0,
      onVictory: def.onVictory,
      mirrorCurseRound1: !!def.mirrorCurseRound1,
      mirrorTriggered: false,
      target: enemies[0] ? enemies[0].id : null,
      round: 0,
      spellsCastThisFight: {},
      playerCopy: null,
      log: []
    };
  };

  Engine.prototype.combatAliveEnemies = function () {
    return this.state.combat.enemies.filter(e => !e.dead && !e.fled);
  };

  Engine.prototype.combatCast = function (spellId, targetId) {
    const s = this.state, c = s.combat;
    if (!c) return { ok: false, msg: 'No fight underway.' };
    if (!c.allowSpells.includes(spellId)) return { ok: false, msg: "That spell won't help here." };
    if (!s.spellbook[spellId] || s.spellbook[spellId] <= 0) return { ok: false, msg: 'No charges left.' };
    const enemy = c.enemies.find(e => e.id === targetId) || c.enemies.find(e => e.id === c.target);
    if (!enemy || enemy.dead || enemy.fled) return { ok: false, msg: 'No target.' };

    s.spellbook[spellId] -= 1;
    c.spellsCastThisFight[spellId] = (c.spellsCastThisFight[spellId] || 0) + 1;

    const mirrorNote = this._maybeMirrorCurse(c, enemy, spellId);

    if (spellId === 'quick') { c.playerSkillBonus = (c.playerSkillBonus || 0) + 2; return { ok: true, msg: 'Your blade feels quicker in your hand.' + mirrorNote }; }
    if (spellId === 'weaken') { enemy.skillMod -= 2; return { ok: true, msg: enemy.name + ' falters, suddenly clumsy.' + mirrorNote }; }
    if (spellId === 'flame') {
      const dmg = 6;
      enemy.stamina = Math.max(0, enemy.stamina - dmg);
      if (enemy.stamina <= 0) enemy.dead = true;
      return { ok: true, msg: 'Fire catches ' + enemy.name + ' full in the chest.', enemyId: enemy.id, dmg };
    }
    if (spellId === 'mirror') {
      c.mirrorTargetId = enemy.id;
      return { ok: true, msg: 'A double of ' + enemy.name + ' peels out of the shadows and turns on the original.', mirror: true };
    }
    return { ok: false, msg: 'Nothing happens.' };
  };

  // Vail Thorne's signature trick: the first buff/debuff cast against him in a fight
  // gets turned back so it cancels itself out.
  Engine.prototype._maybeMirrorCurse = function (c, enemy, spellId) {
    if (!c.mirrorCurseRound1 || c.mirrorTriggered) return '';
    if (spellId !== 'quick' && spellId !== 'weaken') return '';
    c.mirrorTriggered = true;
    if (spellId === 'quick') {
      enemy.skillMod += 2;
      return ' Thorne mirrors the working back at once, and his own guard quickens to match.';
    }
    c.playerSkillBonus = (c.playerSkillBonus || 0) - 2;
    return " Thorne turns the working back on you — your own limbs slow to match his.";
  };

  // Resolve mirror sub-fight instantly (double has enemy's own skill/stamina)
  Engine.prototype.resolveMirror = function () {
    const c = this.state.combat;
    if (!c.mirrorTargetId) return null;
    const enemy = c.enemies.find(e => e.id === c.mirrorTargetId);
    if (!enemy) return null;
    let doubleStamina = enemy.maxStamina;
    let enemyStamina = enemy.stamina;
    const rounds = [];
    let winner = null;
    let guard = 0;
    while (guard++ < 40) {
      const dp = this.roll2Power(enemy.skill); // double uses same skill
      const ep = this.roll2Power(enemy.skill + enemy.skillMod);
      if (dp > ep) { enemyStamina -= 2; rounds.push({ dp, ep, hit: 'double' }); }
      else if (ep > dp) { doubleStamina -= 2; rounds.push({ dp, ep, hit: 'enemy' }); }
      else rounds.push({ dp, ep, hit: 'parry' });
      if (enemyStamina <= 0) { winner = 'double'; break; }
      if (doubleStamina <= 0) { winner = 'enemy'; break; }
    }
    c.mirrorTargetId = null;
    if (winner === 'double') {
      enemy.dead = true;
      return { winner, rounds, msg: 'The double cuts down ' + enemy.name + ' and fades like smoke.' };
    }
    return { winner, rounds, msg: 'The double falls, and ' + enemy.name + ' turns back to you.' };
  };

  Engine.prototype.roll2Power = function (skill) {
    return this.rollDie() * 2 + skill;
  };

  // One round of combat against all alive enemies, player striking `targetId`
  Engine.prototype.combatRound = function (targetId) {
    const s = this.state, c = s.combat;
    const alive = this.combatAliveEnemies();
    if (!alive.length) return { over: true, victory: true };

    const target = alive.find(e => e.id === targetId) || alive[0];
    c.target = target.id;
    const playerSkill = s.skill + (c.playerSkillBonus || 0) - (c.groundPenalty || 0);
    const playerRoll = this.roll2PowerFace(playerSkill);
    const playerPower = playerRoll.power;
    const playerDie = playerRoll.die;

    const results = [];
    let playerHit = false, playerHitDmg = 0;

    alive.forEach(enemy => {
      const enemyRoll = this.roll2PowerFace(enemy.skill + enemy.skillMod);
      const enemyPower = enemyRoll.power;
      const enemyDie = enemyRoll.die;
      let outcome;
      if (enemy.id === target.id) {
        if (playerPower > enemyPower) {
          enemy.stamina = Math.max(0, enemy.stamina - 2);
          if (enemy.stamina <= 0) enemy.dead = true;
          enemy.parryStreak = 0;
          if (enemy.loyalty !== null) { enemy.loyalty -= 2; enemy.parryStreak = 0; }
          outcome = 'wounded';
        } else if (enemyPower > playerPower) {
          const dmg = enemy.loyalty !== null && enemy.loyalty > 18 ? enemy.dmg + 1 : enemy.dmg;
          playerHit = true; playerHitDmg += dmg;
          enemy.parryStreak = 0;
          if (enemy.loyalty !== null) enemy.loyalty += 1;
          outcome = 'player-wounded';
        } else {
          outcome = 'parry';
          enemy.parryStreak = (enemy.parryStreak || 0) + 1;
          if (enemy.loyalty !== null && enemy.parryStreak >= 2) { enemy.loyalty -= 1; enemy.parryStreak = 0; }
        }
      } else {
        // Off-target enemies only hurt the player if they'd have beaten the player's power
        if (enemyPower > playerPower) {
          const dmg = enemy.loyalty !== null && enemy.loyalty > 18 ? enemy.dmg + 1 : enemy.dmg;
          playerHit = true; playerHitDmg += dmg;
          outcome = 'flank';
        } else {
          outcome = 'no-effect';
        }
      }
      if (enemy.loyalty !== null && enemy.loyalty <= 3 && !enemy.dead) { enemy.fled = true; }
      results.push({ id: enemy.id, name: enemy.name, enemyPower, enemyDie, outcome, fled: enemy.fled, dead: enemy.dead });
    });

    if (playerHit) this.damageStamina(playerHitDmg);

    c.round += 1;
    const stillAlive = this.combatAliveEnemies();
    const victory = stillAlive.length === 0;
    const defeat = s.stamina <= 0;

    return { over: victory || defeat, victory, defeat, playerPower, playerDie, playerHitDmg, results };
  };

  Engine.prototype.endCombat = function () {
    this.state.combat = null;
  };

  // ---- save/load a run ----
  Engine.prototype.saveRun = function () {
    try { localStorage.setItem('thornroad.run', JSON.stringify(this.state)); } catch (e) {}
  };
  Engine.prototype.loadRun = function () {
    try {
      const raw = localStorage.getItem('thornroad.run');
      if (!raw) return false;
      this.state = JSON.parse(raw);
      return true;
    } catch (e) { return false; }
  };
  Engine.prototype.clearRun = function () {
    try { localStorage.removeItem('thornroad.run'); } catch (e) {}
  };

  global.Thornroad = global.Thornroad || {};
  global.Thornroad.Engine = Engine;
  global.Thornroad.SPELL_DEFS = SPELL_DEFS;
  global.Thornroad.seedFromString = seedFromString;
})(window);
