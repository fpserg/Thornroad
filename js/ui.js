// Thornroad — UI layer. Reads/writes Engine state, renders the DOM, wires events.
(function (global) {
  'use strict';

  const T = global.Thornroad;
  const STORY = T.STORY;
  const SHOP_ITEMS = T.SHOP_ITEMS;
  const DEATH_FLAVOR = T.DEATH_FLAVOR;
  const SPELL_DEFS = T.SPELL_DEFS;

  const engine = new T.Engine();
  engine.loadMeta();

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const screens = {};
  ['title', 'help', 'create', 'spells', 'play', 'end'].forEach(id => {
    screens[id] = document.getElementById('screen-' + id);
  });

  function showScreen(name) {
    Object.keys(screens).forEach(k => { screens[k].hidden = (k !== name); });
    window.scrollTo(0, 0);
  }

  function toast(msg, ms) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms || 2200);
  }

  // ---------------- TITLE ----------------
  function initTitle() {
    const hasRun = (function () {
      try { return !!localStorage.getItem('thornroad.run'); } catch (e) { return false; }
    })();
    document.getElementById('btn-continue').hidden = !hasRun;
    const meta = engine.meta;
    let metaLine = '';
    if (meta.beaten) metaLine = 'The Hush has receded for you once already.';
    else if (meta.deaths > 0) metaLine = 'The road remembers ' + meta.deaths + (meta.deaths === 1 ? ' fallen traveler.' : ' fallen travelers.');
    document.getElementById('title-meta').textContent = metaLine;

    document.getElementById('btn-new-game').addEventListener('click', () => {
      showScreen('create');
      resetCreateScreen();
    });
    document.getElementById('btn-continue').addEventListener('click', () => {
      if (engine.loadRun()) {
        showScreen('play');
        renderCurrent();
      } else {
        toast("Couldn't find a road to continue.");
      }
    });
    document.getElementById('btn-how-to-play').addEventListener('click', () => showScreen('help'));
    document.getElementById('btn-help-back').addEventListener('click', () => showScreen('title'));
  }

  // ---------------- CHARACTER CREATION ----------------
  let pendingStats = null;
  function resetCreateScreen() {
    pendingStats = null;
    document.getElementById('roll-result').hidden = true;
    document.getElementById('btn-to-spells').disabled = true;
    document.getElementById('seed-input').value = '';
  }
  function initCreate() {
    document.getElementById('btn-roll').addEventListener('click', () => {
      const seedVal = document.getElementById('seed-input').value.trim();
      if (seedVal) engine.setSeed(seedVal);
      else engine.setSeed(Date.now() >>> 0);
      pendingStats = engine.rollNewCharacter();
      document.getElementById('roll-skill').textContent = pendingStats.skill;
      document.getElementById('roll-stamina').textContent = pendingStats.stamina;
      document.getElementById('roll-charm').textContent = pendingStats.charm;
      document.getElementById('roll-result').hidden = false;
      document.getElementById('btn-to-spells').disabled = false;
    });
    document.getElementById('btn-to-spells').addEventListener('click', () => {
      showScreen('spells');
      renderSpellPicker();
    });
  }

  // ---------------- SPELL LOADOUT ----------------
  let loadout = {};
  function renderSpellPicker() {
    loadout = {};
    Object.keys(SPELL_DEFS).forEach(k => loadout[k] = 0);
    const list = document.getElementById('spell-list');
    list.innerHTML = '';
    Object.keys(SPELL_DEFS).forEach(key => {
      const def = SPELL_DEFS[key];
      const row = document.createElement('div');
      row.className = 'spell-row';
      row.innerHTML = `
        <div>
          <div class="spell-name">${def.name}</div>
          <div class="spell-desc">${def.desc}</div>
        </div>
        <div class="stepper">
          <button type="button" class="minus" aria-label="Fewer ${def.name}">−</button>
          <span class="count" data-key="${key}">0</span>
          <button type="button" class="plus" aria-label="More ${def.name}">+</button>
        </div>`;
      const countEl = row.querySelector('.count');
      const minus = row.querySelector('.minus');
      const plus = row.querySelector('.plus');
      function refresh() {
        countEl.textContent = loadout[key];
        minus.disabled = loadout[key] <= 0;
        const total = Object.values(loadout).reduce((a, b) => a + b, 0);
        plus.disabled = total >= 10;
      }
      minus.addEventListener('click', () => { if (loadout[key] > 0) { loadout[key]--; refreshAll(); } });
      plus.addEventListener('click', () => {
        const total = Object.values(loadout).reduce((a, b) => a + b, 0);
        if (total < 10) { loadout[key]++; refreshAll(); }
      });
      row._refresh = refresh;
      list.appendChild(row);
    });
    function refreshAll() {
      $all('.spell-row', list).forEach(r => r._refresh());
      const total = Object.values(loadout).reduce((a, b) => a + b, 0);
      document.getElementById('spell-total').textContent = total;
      document.getElementById('btn-to-play').disabled = total !== 10;
    }
    refreshAll();
  }
  function initSpells() {
    document.getElementById('btn-to-play').addEventListener('click', () => {
      engine.newGame(pendingStats, loadout);
      showScreen('play');
      goTo('n1', true);
    });
  }

  // ---------------- PLAY: navigation & effects ----------------
  function applyEffects(effects) {
    if (!effects) return;
    const s = engine.state;
    effects.forEach(e => {
      if (e.type === 'stat') {
        if (e.stat === 'stamina') {
          if (e.delta < 0) engine.damageStamina(-e.delta); else engine.healStamina(e.delta);
        } else if (e.stat === 'skill') {
          s.skill = Math.max(1, s.skill + e.delta);
        } else if (e.stat === 'charm') {
          s.charm = Math.max(1, Math.min(12, s.charm + e.delta));
        }
      } else if (e.type === 'item') {
        const ok = engine.addItem(e.item);
        if (!ok) toast('Your pack is full — you leave the ' + e.item.name.toLowerCase() + ' behind.');
        else engine.log('You take the ' + e.item.name.toLowerCase() + '.');
      } else if (e.type === 'flag') {
        s.flags[e.name] = true;
      } else if (e.type === 'drinkFlask') {
        engine.drinkFlask();
      } else if (e.type === 'coins') {
        s.coins = Math.max(0, s.coins + e.delta);
      }
    });
  }

  function markOnce(nodeId, idx) {
    engine.state.flags['once_' + nodeId + '_' + idx] = true;
  }
  function isOnceUsed(nodeId, idx) {
    return !!engine.state.flags['once_' + nodeId + '_' + idx];
  }

  function meetsRequires(req) {
    if (!req) return true;
    const s = engine.state;
    if (req.item && !engine.hasItem(req.item)) return false;
    if (req.flag && !s.flags[req.flag]) return false;
    if (req.anySpell && !req.anySpell.some(id => s.spellbook[id] > 0)) return false;
    return true;
  }
  function requireHint(req) {
    if (!req) return '';
    if (req.item) return 'needs: ' + (findItemName(req.item));
    if (req.flag) return 'you have not found the way';
    if (req.anySpell) return 'needs a spell you do not have';
    return '';
  }
  function findItemName(id) {
    const names = {
      tarnished_ring: 'the tarnished ring', ember_lens: 'the ember-glass lens', skeleton_key: 'the iron key',
      guard_cloak: 'the guard cloak', silver_locket: 'the silver locket', old_ledger: "the warlock's ledger",
      brass_token: 'a brass token'
    };
    return names[id] || id;
  }

  function goTo(targetId, isFirst) {
    const node = STORY[targetId];
    if (!node) { console.error('Missing node', targetId); return; }
    if (!isFirst && node.onEnter) applyEffects(node.onEnter.effects);
    if (engine.state.dead && !node.ending) {
      engine.state.nodeId = 'ending_death';
    } else {
      engine.state.nodeId = targetId;
    }
    engine.saveRun();
    render();
  }

  function renderCurrent() { render(); }

  function render() {
    const nodeId = engine.state.nodeId;
    const node = STORY[nodeId];
    if (!node) { console.error('Missing node on render', nodeId); return; }

    updateStatusBar();

    if (node.ending) { renderEnding(node); return; }

    const textEl = document.getElementById('story-text');
    const extraEl = document.getElementById('story-extra');
    const choicebar = document.getElementById('choicebar');
    textEl.innerHTML = paragraphs(node.text);
    extraEl.innerHTML = '';
    choicebar.innerHTML = '';

    if (node.combat) { renderCombat(node, extraEl, choicebar); return; }
    if (node.riddle) { renderRiddle(node, extraEl); return; }
    if (node.luckCheck) { renderLuckCheck(node, extraEl); return; }
    if (node.charmCheck) { renderCharmCheck(node, extraEl); return; }
    if (node.shop) { renderShop(node, extraEl); }

    if (node.choices) renderChoices(node, nodeId, choicebar);
  }

  function paragraphs(text) {
    return text.split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join('');
  }
  function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderChoices(node, nodeId, container) {
    node.choices.forEach((choice, idx) => {
      if (choice.once && isOnceUsed(nodeId, idx)) return;
      const met = meetsRequires(choice.requires);
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      if (!met) {
        btn.disabled = true;
        btn.innerHTML = escapeHtml(choice.label) + `<span class="req-note">${escapeHtml(requireHint(choice.requires))}</span>`;
      } else {
        btn.textContent = choice.label;
        btn.addEventListener('click', () => {
          if (choice.once) markOnce(nodeId, idx);
          if (choice.effects) applyEffects(choice.effects);
          goTo(choice.to);
        });
      }
      container.appendChild(btn);
    });
  }

  function renderLuckCheck(node, extraEl) {
    const box = document.createElement('div');
    box.className = 'notice';
    box.textContent = 'Your fortune may decide this.';
    extraEl.appendChild(box);
    const btn = document.createElement('button');
    btn.className = 'choice-btn primary';
    btn.textContent = 'Test your luck';
    btn.addEventListener('click', () => {
      const result = engine.checkLuck();
      toast(result.lucky ? 'Luck holds (rolled ' + result.roll + ').' : 'Luck fails you (rolled ' + result.roll + ').');
      updateStatusBar();
      goTo(result.lucky ? node.luckCheck.onSuccess : node.luckCheck.onFail);
    });
    document.getElementById('choicebar').appendChild(btn);
  }

  function renderCharmCheck(node, extraEl) {
    const box = document.createElement('div');
    box.className = 'notice';
    box.textContent = 'This may come down to how well you can talk your way through.';
    extraEl.appendChild(box);
    const btn = document.createElement('button');
    btn.className = 'choice-btn primary';
    btn.textContent = 'Try to persuade';
    btn.addEventListener('click', () => {
      const result = engine.checkCharm();
      toast(result.success ? 'They believe you (rolled ' + result.roll + ').' : "They don't buy it (rolled " + result.roll + ').');
      updateStatusBar();
      goTo(result.success ? node.charmCheck.onSuccess : node.charmCheck.onFail);
    });
    document.getElementById('choicebar').appendChild(btn);
  }

  function renderRiddle(node, extraEl) {
    const form = document.createElement('div');
    form.className = 'riddle-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Your answer…';
    input.autocomplete = 'off';
    const btn = document.createElement('button');
    btn.className = 'choice-btn primary';
    btn.style.flex = '0 0 auto';
    btn.textContent = 'Answer';
    function submit() {
      const norm = input.value.trim().toLowerCase().replace(/[^\w\s]/g, '');
      const ok = node.riddle.accept.some(a => a.toLowerCase() === norm);
      goTo(ok ? node.riddle.onCorrect : node.riddle.onWrong);
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    form.appendChild(input); form.appendChild(btn);
    extraEl.appendChild(form);
    setTimeout(() => input.focus(), 50);
  }

  function renderShop(node, extraEl) {
    const s = engine.state;
    const wrap = document.createElement('div');
    wrap.className = 'shop-list';
    const header = document.createElement('div');
    header.className = 'notice';
    header.textContent = 'You have ' + s.coins + ' coins.';
    extraEl.appendChild(header);
    SHOP_ITEMS.forEach(item => {
      const already = item.stackId ? false : engine.hasItem(item.id);
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div>
          <div class="shop-name">${item.name}</div>
          <div class="shop-desc">${item.desc}</div>
          <div class="shop-cost">${item.cost} coins</div>
        </div>`;
      const buyBtn = document.createElement('button');
      buyBtn.className = 'buy-btn';
      buyBtn.textContent = already ? 'Owned' : 'Buy';
      buyBtn.disabled = already || s.coins < item.cost;
      buyBtn.addEventListener('click', () => {
        if (s.coins < item.cost) return;
        s.coins -= item.cost;
        if (item.permanentStat) {
          if (item.permanentStat.stat === 'skill') { s.skill += item.permanentStat.delta; s.maxSkill += item.permanentStat.delta; }
        } else if (item.stackId === 'rations') {
          const r = s.pack.find(i => i.id === 'rations');
          if (r) r.qty += item.qty; else engine.addItem({ id: 'rations', name: 'Trail rations', slots: 1, qty: item.qty, stackable: true });
        } else {
          engine.addItem({ id: item.id, name: item.name, slots: item.slots });
        }
        engine.saveRun();
        toast('Bought ' + item.name.toLowerCase() + '.');
        renderShop(node, extraEl);
        header.textContent = 'You have ' + s.coins + ' coins.';
        updateStatusBar();
      });
      row.appendChild(buyBtn);
      wrap.appendChild(row);
    });
    extraEl.appendChild(wrap);
  }

  // ---------------- COMBAT ----------------
  function renderCombat(node, extraEl, choicebar) {
    const s = engine.state;
    if (!s.combat || s.combat._sourceNode !== node) {
      engine.startCombat(node.combat);
      s.combat._sourceNode = node;
    }
    const c = s.combat;

    const panel = document.createElement('div');
    panel.className = 'combat-panel';

    c.enemies.forEach(en => {
      const row = document.createElement('div');
      row.className = 'enemy-row';
      const pct = Math.max(0, Math.round((en.stamina / en.maxStamina) * 100));
      let status = '';
      if (en.dead) status = ' (defeated)';
      else if (en.fled) status = ' (fled)';
      row.innerHTML = `
        <div class="enemy-name ${en.dead ? 'dead' : ''} ${en.fled ? 'fled' : ''}">${en.name}${status}</div>
        <div></div>
        <div class="enemy-bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
      if (!en.dead && !en.fled && enemiesAlive(c).length > 1) {
        const tbtn = document.createElement('button');
        tbtn.className = 'enemy-target-btn' + (c.target === en.id ? ' selected' : '');
        tbtn.textContent = c.target === en.id ? 'Targeting' : 'Target';
        tbtn.addEventListener('click', () => { c.target = en.id; renderCombat(node, extraEl, choicebar); });
        row.children[1].appendChild(tbtn);
      }
      panel.appendChild(row);
    });

    const log = document.createElement('div');
    log.className = 'combat-log';
    log.innerHTML = (c.log || []).slice(-4).map(l => `<div>${escapeHtml(l)}</div>`).join('');
    panel.appendChild(log);

    extraEl.innerHTML = '';
    extraEl.appendChild(panel);

    const alive = enemiesAlive(c);
    choicebar.innerHTML = '';

    if (alive.length === 0) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn primary';
      btn.textContent = 'Move on';
      btn.addEventListener('click', () => { engine.endCombat(); goTo(c.onVictory); });
      choicebar.appendChild(btn);
      return;
    }

    // spells
    const spellRow = document.createElement('div');
    spellRow.className = 'spell-quickbar';
    (node.combat.allowSpells || []).forEach(spellId => {
      const charges = s.spellbook[spellId] || 0;
      const chip = document.createElement('button');
      chip.className = 'spell-chip';
      chip.textContent = SPELL_DEFS[spellId].name + ' (' + charges + ')';
      chip.disabled = charges <= 0;
      chip.addEventListener('click', () => {
        const res = engine.combatCast(spellId, c.target);
        if (!res.ok) { toast(res.msg); return; }
        c.log = c.log || [];
        c.log.push(res.msg);
        if (res.mirror) {
          const mres = engine.resolveMirror();
          if (mres) c.log.push(mres.msg);
        }
        engine.saveRun();
        updateStatusBar();
        renderCombat(node, extraEl, choicebar);
      });
      spellRow.appendChild(chip);
    });
    if (spellRow.children.length) extraEl.appendChild(spellRow);

    if (node.combat.illusionEscape && c.round === 0 && (s.spellbook.illusion || 0) > 0) {
      const escBtn = document.createElement('button');
      escBtn.className = 'choice-btn';
      escBtn.textContent = 'Cast Seeming and slip away (uses 1 charge)';
      escBtn.addEventListener('click', () => {
        s.spellbook.illusion -= 1;
        const esc = node.combat.illusionEscape;
        engine.log(esc.text);
        engine.endCombat();
        toast(esc.text, 3200);
        goTo(esc.to);
      });
      choicebar.appendChild(escBtn);
    }

    const atk = document.createElement('button');
    atk.className = 'choice-btn primary';
    atk.textContent = alive.length > 1 ? 'Strike your target' : 'Attack';
    atk.addEventListener('click', () => {
      const result = engine.combatRound(c.target);
      c.log = c.log || [];
      result.results.forEach(r => {
        if (r.outcome === 'wounded') c.log.push('You wound ' + r.name + '.');
        else if (r.outcome === 'player-wounded') c.log.push(r.name + ' wounds you.');
        else if (r.outcome === 'flank') c.log.push(r.name + ' catches you from the side.');
        else if (r.outcome === 'parry') c.log.push('You and ' + r.name + ' trade blows and neither lands.');
        if (r.fled) c.log.push(r.name + ' breaks and flees.');
        if (r.dead && r.outcome === 'wounded') c.log.push(r.name + ' falls.');
      });
      engine.saveRun();
      updateStatusBar();
      if (engine.state.dead) {
        engine.endCombat();
        engine.meta.deaths = (engine.meta.deaths || 0) + 1;
        engine.saveMeta();
        goTo('ending_death', true);
        return;
      }
      renderCombat(node, extraEl, choicebar);
    });
    choicebar.appendChild(atk);
  }
  function enemiesAlive(c) { return c.enemies.filter(e => !e.dead && !e.fled); }

  // ---------------- ENDING ----------------
  function renderEnding(node) {
    showScreen('end');
    const s = engine.state;
    const badge = document.getElementById('end-badge');
    const title = document.getElementById('end-title');
    const text = document.getElementById('end-text');
    const stats = document.getElementById('end-stats');
    badge.className = 'end-badge ' + node.ending.type;
    badge.textContent = node.ending.type === 'victory' ? '✓' : (node.ending.type === 'retreat' ? '~' : '✕');
    title.textContent = node.ending.title;
    let body = node.text;
    if (node.ending.type === 'death') {
      const flavor = DEATH_FLAVOR[Math.floor(Math.random() * DEATH_FLAVOR.length)];
      body = body + '\n\n' + flavor;
    }
    text.innerHTML = paragraphs(body);

    if (node.ending.type === 'victory') {
      engine.meta.beaten = true;
      engine.saveMeta();
    } else if (node.ending.type === 'death') {
      // death count already incremented at point of death; guard against double count on refresh
    }
    engine.clearRun();

    stats.innerHTML = `Skill ${s.skill} · Stamina ${s.stamina}/${s.maxStamina} · Charm ${s.charm} · ${s.coins} coins carried`;
  }

  document.getElementById('btn-again').addEventListener('click', () => {
    showScreen('title');
    initTitle();
  });

  // ---------------- STATUS BAR ----------------
  function updateStatusBar() {
    const s = engine.state;
    if (!s) return;
    document.getElementById('pip-skill').querySelector('.pip-val').textContent = s.skill;
    document.getElementById('pip-stamina').querySelector('.pip-val').textContent = s.stamina + '/' + s.maxStamina;
    document.getElementById('pip-stamina').classList.toggle('low', s.stamina <= Math.ceil(s.maxStamina * 0.25));
    document.getElementById('pip-charm').querySelector('.pip-val').textContent = s.charm;
    document.getElementById('pip-coins').querySelector('.pip-val').textContent = s.coins;
    const lb = document.getElementById('luck-boxes');
    lb.innerHTML = '';
    s.luck.forEach(used => {
      const box = document.createElement('div');
      box.className = 'luck-box' + (used ? ' used' : '');
      lb.appendChild(box);
    });
  }

  // ---------------- DRAWER ----------------
  function initDrawer() {
    const drawer = document.getElementById('drawer');
    document.getElementById('btn-menu').addEventListener('click', () => { drawer.hidden = false; renderDrawer(); });
    document.getElementById('drawer-close').addEventListener('click', () => { drawer.hidden = true; });
    document.getElementById('drawer-backdrop').addEventListener('click', () => { drawer.hidden = true; });
    $all('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $all('.tab-btn').forEach(b => b.classList.remove('active'));
        $all('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  function renderDrawer() {
    const s = engine.state;
    if (!s) return;

    const packEl = document.getElementById('tab-pack');
    const slots = engine.usedSlots();
    let html = `<div class="slots-meter">${slots} / ${s.packLimit} slots used · flask: ${s.flask} sips</div>`;
    if (!s.pack.length) html += `<div class="pack-empty">Nothing but your sword and your nerve.</div>`;
    s.pack.forEach(item => {
      html += `<div class="pack-item"><span class="it-name">${escapeHtml(item.name)}</span>`;
      if (item.qty) html += ` <span class="it-qty">×${item.qty}</span>`;
      html += `</div>`;
    });
    packEl.innerHTML = html;
    if (s.pack.some(i => i.id === 'rations') || s.flask > 0) {
      const row = document.createElement('div');
      row.className = 'action-row';
      if (s.pack.some(i => i.id === 'rations')) {
        const b = document.createElement('button');
        b.className = 'mini-btn'; b.textContent = 'Eat a ration (+4 Sta)';
        b.addEventListener('click', () => { engine.eatRation(); engine.saveRun(); updateStatusBar(); renderDrawer(); });
        row.appendChild(b);
      }
      if (s.flask > 0) {
        const b = document.createElement('button');
        b.className = 'mini-btn'; b.textContent = 'Drink flask (+2 Sta)';
        b.addEventListener('click', () => { engine.drinkFlask(); engine.saveRun(); updateStatusBar(); renderDrawer(); });
        row.appendChild(b);
      }
      packEl.appendChild(row);
    }

    const spellsEl = document.getElementById('tab-spells');
    spellsEl.innerHTML = '';
    Object.keys(SPELL_DEFS).forEach(key => {
      const charges = s.spellbook[key] || 0;
      const row = document.createElement('div');
      row.className = 'spell-stock-row';
      row.innerHTML = `<span>${SPELL_DEFS[key].name}</span><span>${charges} left</span>`;
      spellsEl.appendChild(row);
      if (key === 'mend' && charges > 0 && !s.combat) {
        const b = document.createElement('button');
        b.className = 'mini-btn'; b.textContent = 'Cast (+8 Sta)';
        b.addEventListener('click', () => { engine.castOutOfCombat('mend'); engine.saveRun(); updateStatusBar(); renderDrawer(); });
        row.appendChild(b);
      }
    });

    const journalEl = document.getElementById('tab-journal');
    journalEl.innerHTML = '';
    if (!s.journal.length) journalEl.innerHTML = `<div class="pack-empty">Nothing written down yet.</div>`;
    s.journal.slice().reverse().forEach(line => {
      const d = document.createElement('div');
      d.className = 'journal-entry';
      d.textContent = line;
      journalEl.appendChild(d);
    });
  }

  T.UI = {
    init() {
      initTitle();
      initCreate();
      initSpells();
      initDrawer();
    }
  };
})(window);
