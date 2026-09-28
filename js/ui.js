// Thornroad — UI layer. Reads/writes Engine state, renders the DOM, wires events.
(function (global) {
  'use strict';

  const T = global.Thornroad;
  const STORY = T.STORY;
  const SHOP_ITEMS = T.SHOP_ITEMS;
  const DEATH_FLAVOR = T.DEATH_FLAVOR;
  const SPELL_DEFS = T.SPELL_DEFS;
  const STORY_RU = T.STORY_RU || {};
  const DEATH_FLAVOR_RU = T.DEATH_FLAVOR_RU || DEATH_FLAVOR;
  const ITEM_NAMES_RU = T.ITEM_NAMES_RU || {};
  const SHOP_ITEMS_RU = T.SHOP_ITEMS_RU || {};
  const SPELL_STRINGS_RU = T.SPELL_STRINGS_RU || {};
  const ZONE_BANNERS = T.ZONE_BANNERS || {};
  const ENDING_BANNERS = T.ENDING_BANNERS || {};
  const zoneFor = T.zoneFor || function () { return 'forest'; };
  const DiceFX = T.DiceFX || null;

  const engine = new T.Engine();
  engine.loadMeta();

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ---------------- I18N ----------------
  let locale = 'en';
  try { locale = localStorage.getItem('thornroad.locale') || 'en'; } catch (e) { /* ignore */ }

  // ---------------- DIFFICULTY ----------------
  let chosenDifficulty = 'normal';
  try { chosenDifficulty = localStorage.getItem('thornroad.difficulty') || 'normal'; } catch (e) { /* ignore */ }
  if (!T.DIFFICULTIES || !T.DIFFICULTIES[chosenDifficulty]) chosenDifficulty = 'normal';

  function spellName(id) { return (locale === 'ru' && SPELL_STRINGS_RU[id] && SPELL_STRINGS_RU[id].name) || SPELL_DEFS[id].name; }
  function spellDesc(id) { return (locale === 'ru' && SPELL_STRINGS_RU[id] && SPELL_STRINGS_RU[id].desc) || SPELL_DEFS[id].desc; }
  function itemDisplayName(id, fallback) { return (locale === 'ru' && ITEM_NAMES_RU[id]) || fallback; }
  function shopName(item) { return (locale === 'ru' && SHOP_ITEMS_RU[item.id] && SHOP_ITEMS_RU[item.id].name) || item.name; }
  function shopDesc(item) { return (locale === 'ru' && SHOP_ITEMS_RU[item.id] && SHOP_ITEMS_RU[item.id].desc) || item.desc; }
  function deathFlavorList() { return locale === 'ru' ? DEATH_FLAVOR_RU : DEATH_FLAVOR; }

  // Static (fixed) UI chrome strings, by key.
  const STR_EN = {
    fortuneNotice: 'Your fortune may decide this.',
    testLuck: 'Test your luck',
    luckHolds: roll => 'Luck holds (rolled ' + roll + ').',
    luckFails: roll => 'Luck fails you (rolled ' + roll + ').',
    charmNotice: 'This may come down to how well you can talk your way through.',
    persuade: 'Try to persuade',
    charmSuccess: roll => 'They believe you (rolled ' + roll + ').',
    charmFail: roll => "They don't buy it (rolled " + roll + ').',
    riddlePlaceholder: 'Your answer…',
    riddleAnswer: 'Answer',
    youHaveCoins: n => 'You have ' + n + ' coins.',
    coinsSuffix: n => n + ' coins',
    owned: 'Owned',
    buy: 'Buy',
    bought: name => 'Bought ' + name.toLowerCase() + '.',
    packFull: name => 'Your pack is full — you leave the ' + name.toLowerCase() + ' behind.',
    youTake: name => 'You take the ' + name.toLowerCase() + '.',
    defeated: ' (defeated)',
    fled: ' (fled)',
    target: 'Target',
    targeting: 'Targeting',
    moveOn: 'Move on',
    strikeTarget: 'Strike your target',
    attack: 'Attack',
    illusionEscapeBtn: verb => 'Cast ' + verb + ' and slip away (uses 1 charge)',
    needsItem: name => 'needs: ' + name,
    needsFlag: 'you have not found the way',
    needsSpell: 'needs a spell you do not have',
    noRoad: "Couldn't find a road to continue.",
    hushReceded: 'The Hush has receded for you once already.',
    fallenOne: 'The road remembers 1 fallen traveler.',
    fallenMany: n => 'The road remembers ' + n + ' fallen travelers.',
    packEmpty: 'Nothing but your sword and your nerve.',
    eatRation: 'Eat a ration (+4 Sta)',
    drinkFlask: 'Drink flask (+2 Sta)',
    castMend: 'Cast (+8 Sta)',
    slotsMeter: (used, limit, flask) => used + ' / ' + limit + ' slots used · flask: ' + flask + ' sips',
    chargesLeft: n => n + ' left',
    journalEmpty: 'Nothing written down yet.',
    endStats: (skl, sta, staMax, chm, coins, diff) => `Skill ${skl} · Stamina ${sta}/${staMax} · Charm ${chm} · ${coins} coins carried · ${diff}`,
    diffName: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
    diffDesc: {
      easy: 'A gentler road — more Stamina to start, lighter blows, and traps that sting rather than maim.',
      normal: "The road as it's meant to be walked.",
      hard: 'The Hush shows no mercy — less Stamina to start, harder-hitting foes, and traps that draw real blood.'
    }
  };
  const STR_RU = {
    fortuneNotice: 'Всё может решить ваша удача.',
    testLuck: 'Испытать удачу',
    luckHolds: roll => 'Удача не подводит (выпало ' + roll + ').',
    luckFails: roll => 'Удача отворачивается (выпало ' + roll + ').',
    charmNotice: 'Здесь всё может решить то, насколько убедительно вы говорите.',
    persuade: 'Попытаться убедить',
    charmSuccess: roll => 'Вам верят (выпало ' + roll + ').',
    charmFail: roll => 'Вам не верят (выпало ' + roll + ').',
    riddlePlaceholder: 'Ваш ответ…',
    riddleAnswer: 'Ответить',
    youHaveCoins: n => 'У вас ' + n + ' монет.',
    coinsSuffix: n => n + ' монет',
    owned: 'Куплено',
    buy: 'Купить',
    bought: name => 'Куплено: ' + name.toLowerCase() + '.',
    packFull: name => 'Ваш мешок полон — вы оставляете «' + name.toLowerCase() + '» позади.',
    youTake: name => 'Вы забираете: ' + name.toLowerCase() + '.',
    defeated: ' (повержен)',
    fled: ' (бежал)',
    target: 'Цель',
    targeting: 'Цель выбрана',
    moveOn: 'Идти дальше',
    strikeTarget: 'Атаковать цель',
    attack: 'Атаковать',
    illusionEscapeBtn: verb => 'Использовать «' + verb + '» и ускользнуть (1 заряд)',
    needsItem: name => 'нужно: ' + name,
    needsFlag: 'вы ещё не нашли путь',
    needsSpell: 'нужно заклинание, которого у вас нет',
    noRoad: 'Не удалось найти дорогу, чтобы продолжить.',
    hushReceded: 'Тишь уже однажды отступила перед вами.',
    fallenOne: 'Дорога помнит одного павшего путника.',
    fallenMany: n => 'Дорога помнит павших путников: ' + n + '.',
    packEmpty: 'Ничего, кроме меча и выдержки.',
    eatRation: 'Съесть паёк (+4 Силы)',
    drinkFlask: 'Отпить из фляги (+2 Силы)',
    castMend: 'Использовать (+8 Силы)',
    slotsMeter: (used, limit, flask) => used + ' / ' + limit + ' слотов занято · фляга: ' + flask + ' глотков',
    chargesLeft: n => 'осталось: ' + n,
    journalEmpty: 'Пока ничего не записано.',
    endStats: (skl, sta, staMax, chm, coins, diff) => `Ловкость ${skl} · Сила ${sta}/${staMax} · Обаяние ${chm} · монет с собой: ${coins} · ${diff}`,
    diffName: { easy: 'Лёгкая', normal: 'Обычная', hard: 'Сложная' },
    diffDesc: {
      easy: 'Более мягкая дорога — больше Силы для начала, слабее удары, а ловушки скорее жалят, чем калечат.',
      normal: 'Дорога такая, какой она задумана.',
      hard: 'Тишь не знает пощады — меньше Силы для начала, враги бьют сильнее, а ловушки ранят по-настоящему.'
    }
  };
  function S() { return locale === 'ru' ? STR_RU : STR_EN; }
  function tr(key, ...args) {
    const v = S()[key];
    return typeof v === 'function' ? v(...args) : v;
  }

  // Translates the fixed set of English combat/journal messages the Engine
  // generates (engine.js stays locale-agnostic; this is a display-only pass).
  const MSG_TABLE_RU = [
    [/^No fight underway\.$/, 'Бой ещё не начался.'],
    [/^That spell won't help here\.$/, 'Это заклинание здесь не поможет.'],
    [/^No charges left\.$/, 'Не осталось зарядов.'],
    [/^No target\.$/, 'Нет цели.'],
    [/^Your blade feels quicker in your hand\.$/, 'Ваш клинок словно стал быстрее в руке.'],
    [/^(.+) falters, suddenly clumsy\.$/, '$1 внезапно теряет ловкость.'],
    [/^Fire catches (.+) full in the chest\.$/, 'Пламя обрушивается на $1.'],
    [/^A double of (.+) peels out of the shadows and turns on the original\.$/, 'Двойник $1 выступает из тени и обращается против оригинала.'],
    [/^Nothing happens\.$/, 'Ничего не происходит.'],
    [/^The double cuts down (.+) and fades like smoke\.$/, 'Двойник повергает $1 и растворяется, как дым.'],
    [/^The double falls, and (.+) turns back to you\.$/, 'Двойник падает, и $1 вновь обращается к вам.'],
    [/^You wound (.+)\.$/, 'Вы раните $1.'],
    [/^(.+) wounds you\.$/, '$1 ранит вас.'],
    [/^(.+) catches you from the side\.$/, '$1 достаёт вас сбоку.'],
    [/^You and (.+) trade blows and neither lands\.$/, 'Вы и $1 обмениваетесь ударами, но ни один не достигает цели.'],
    [/^(.+) breaks and flees\.$/, '$1 не выдерживает и бежит.'],
    [/^(.+) falls\.$/, '$1 падает.'],
    [/^ Thorne mirrors the working back at once, and his own guard quickens to match\.$/, ' Торн тут же отражает заклятие обратно, и его защита ускоряется в ответ.'],
    [/^ Thorne turns the working back on you — your own limbs slow to match his\.$/, ' Торн обращает заклятие против вас — ваши движения замедляются в ответ.'],
    [/^You set out from Fenhollow keep, sword at your hip and the Hush ahead of you\.$/, 'Вы выходите из крепости Фенхоллоу, с мечом у бедра и Тишью впереди.'],
    [/^You eat a ration \(\+4 Stamina\)\.$/, 'Вы съедаете паёк (+4 Силы).'],
    [/^You drink from your flask \(\+2 Stamina\)\.$/, 'Вы отпиваете из фляги (+2 Силы).'],
    [/^You cast Mend \(\+8 Stamina\)\.$/, 'Вы используете Исцеление (+8 Силы).']
  ];
  function trMsg(msg) {
    if (locale !== 'ru' || !msg) return msg;
    for (const [re, rep] of MSG_TABLE_RU) {
      if (re.test(msg)) return msg.replace(re, rep);
    }
    return msg;
  }

  // Data-driven translation overlay for story nodes. Cached per (locale, nodeId)
  // so object identity stays stable across repeated renders of the same node
  // (combat rendering compares node references).
  const localizedCache = {};
  function getNode(id) {
    const raw = STORY[id];
    if (!raw || locale !== 'ru') return raw;
    const key = 'ru|' + id;
    if (localizedCache[key]) return localizedCache[key];
    const ru = STORY_RU[id];
    let merged = raw;
    if (ru) {
      merged = Object.assign({}, raw);
      if (ru.text) merged.text = ru.text;
      if (ru.choices && raw.choices) {
        merged.choices = raw.choices.map((c, i) => ru.choices[i] ? Object.assign({}, c, { label: ru.choices[i] }) : c);
      }
      if (raw.riddle && ru.riddleAccept) {
        merged.riddle = Object.assign({}, raw.riddle, { accept: raw.riddle.accept.concat(ru.riddleAccept) });
      }
      if (raw.ending && ru.endingTitle) {
        merged.ending = Object.assign({}, raw.ending, { title: ru.endingTitle });
      }
      if (raw.combat && ru.enemyNames) {
        merged.combat = Object.assign({}, raw.combat, {
          enemies: raw.combat.enemies.map((e, i) => ru.enemyNames[i] ? Object.assign({}, e, { name: ru.enemyNames[i] }) : e)
        });
        if (raw.combat.illusionEscape && ru.illusionEscapeText) {
          merged.combat.illusionEscape = Object.assign({}, raw.combat.illusionEscape, { text: ru.illusionEscapeText });
        }
      }
    }
    localizedCache[key] = merged;
    return merged;
  }

  // Static screen chrome (title, help, create, spells, drawer, etc.) translated
  // via data-i18n attributes rather than element-by-element JS.
  const STATIC_RU = {
    difficultyLabel: 'Сложность',
    diffEasy: 'Лёгкая', diffNormal: 'Обычная', diffHard: 'Сложная',
    titleSub: 'Гейм-бук о Тиши и Пепельном Шпиле',
    setOut: 'Отправиться в путь',
    continueJourney: 'Продолжить путь',
    howItWorks: 'Как это работает',
    helpP1: 'Thornroad — это гейм-бук, где всё решают кости. Вы читаете сцену и выбираете, что делать; дальше решают дорога, кости и то, что у вас с собой.',
    helpLi1_html: '<strong>Ловкость, Сила, Обаяние</strong> — определяются один раз в начале. Сила — это ваше здоровье: на нуле путешествие заканчивается. Ловкость и Обаяние могут расти или падать по ходу игры, но никогда не выше начального значения.',
    helpLi2_html: '<strong>Удача</strong> — шесть клеток. Испытание удачи зачёркивает одну; если она уже была зачёркнута, удача вам не улыбнулась. Зачёркнутые клетки иногда можно очистить снова.',
    helpLi3_html: '<strong>Бой</strong> — каждый раунд вы и противник бросаете кости; у кого выше — тот ранит другого на 2 Силы (ничья — обмен ударами впустую). У некоторых врагов есть Стойкость: раньте их достаточно или переживите — и они дрогнут и побегут.',
    helpLi4_html: '<strong>Заклинания</strong> — выбираются перед выходом в путь, десять зарядов на восемь заклинаний, как вам угодно. Использованное заклинание пропадает до конца путешествия.',
    helpLi5_html: '<strong>Мешок</strong> — семь слотов для всего, что вы найдёте или купите. Выбирайте с умом.',
    helpP2: 'Если ваше путешествие обрывается, дорога немного помнит из того, что вы узнали — ответы на загадки и найденные пути остаются с вами в следующий раз.',
    back: 'Назад',
    whoSetsOut: 'Кто отправляется в путь',
    createMuted: 'Бросьте кости, чтобы узнать, из чего вы сделаны. Эти начальные числа станут вашим потолком на всё путешествие.',
    rollDice: 'Бросить кости',
    skill: 'Ловкость', stamina: 'Сила', charm: 'Обаяние',
    seedLabel: 'Сид (необязательно, для общей или повторяемой дороги)',
    seedPlaceholder: 'оставьте пустым для новой дороги',
    chooseSpells: 'Выбрать заклинания',
    tenChargesEight: 'Десять зарядов, восемь заклинаний',
    spellsMuted: 'Хейл успеет научить вас лишь десяти применениям заклинаний. Тратьте их как хотите — повторы разрешены.',
    chargesAssigned: 'Назначено зарядов:',
    takeTheRoad: 'Выйти на дорогу',
    coins: 'Монеты', luck: 'Удача',
    sklAbbr: 'ЛОВ', staAbbr: 'СИЛ', chmAbbr: 'ОБ',
    menuAria: 'Открыть мешок, заклинания и журнал',
    tabPack: 'Мешок', tabSpells: 'Заклинания', tabJournal: 'Журнал',
    drawerClose: 'Закрыть',
    setOutAgain: 'Отправиться снова'
  };

  function applyStaticLocale() {
    if (locale !== 'ru') return;
    $all('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (STATIC_RU[key] != null) el.textContent = STATIC_RU[key];
    });
    $all('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (STATIC_RU[key] != null) el.innerHTML = STATIC_RU[key];
    });
    $all('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (STATIC_RU[key] != null) el.placeholder = STATIC_RU[key];
    });
    $all('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (STATIC_RU[key] != null) el.title = STATIC_RU[key];
    });
    $all('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (STATIC_RU[key] != null) el.setAttribute('aria-label', STATIC_RU[key]);
    });
    document.documentElement.lang = 'ru';
  }

  function setLocale(l) {
    locale = l;
    try { localStorage.setItem('thornroad.locale', l); } catch (e) { /* ignore */ }
    document.documentElement.lang = (l === 'ru' ? 'ru' : 'en');
    applyStaticLocale();
    updateLocaleToggle();
  }

  function updateLocaleToggle() {
    const btn = document.getElementById('btn-locale');
    if (btn) btn.textContent = locale === 'ru' ? 'EN' : 'RU';
  }

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
    if (meta.beaten) metaLine = tr('hushReceded');
    else if (meta.deaths > 0) metaLine = meta.deaths === 1 ? tr('fallenOne') : tr('fallenMany', meta.deaths);
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
        toast(tr('noRoad'));
      }
    });
    document.getElementById('btn-how-to-play').addEventListener('click', () => showScreen('help'));
    document.getElementById('btn-help-back').addEventListener('click', () => showScreen('title'));

    const localeBtn = document.getElementById('btn-locale');
    if (localeBtn && !localeBtn._wired) {
      localeBtn._wired = true;
      updateLocaleToggle();
      localeBtn.addEventListener('click', () => {
        setLocale(locale === 'ru' ? 'en' : 'ru');
        initTitle();
      });
    }
    applyStaticLocale();
  }

  // ---------------- CHARACTER CREATION ----------------
  let pendingStats = null;
  function updateDifficultyDesc() {
    const el = document.getElementById('difficulty-desc');
    if (el) el.textContent = (S().diffDesc && S().diffDesc[chosenDifficulty]) || '';
  }
  function resetCreateScreen() {
    pendingStats = null;
    document.getElementById('roll-result').hidden = true;
    document.getElementById('btn-to-spells').disabled = true;
    document.getElementById('seed-input').value = '';
    updateDifficultyDesc();
  }
  function initCreate() {
    $all('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenDifficulty = btn.dataset.diff;
        try { localStorage.setItem('thornroad.difficulty', chosenDifficulty); } catch (e) { /* ignore */ }
        $all('.diff-btn').forEach(b => b.classList.toggle('active', b === btn));
        // Any roll already made reflects the old difficulty's Stamina bonus — clear it
        // (also re-applies the description text for the new selection).
        resetCreateScreen();
      });
    });
    $all('.diff-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === chosenDifficulty));
    updateDifficultyDesc();

    document.getElementById('btn-roll').addEventListener('click', () => {
      const seedVal = document.getElementById('seed-input').value.trim();
      if (seedVal) engine.setSeed(seedVal);
      else engine.setSeed(Date.now() >>> 0);
      engine.setDifficulty(chosenDifficulty);
      pendingStats = engine.rollNewCharacter();
      const rollBtn = document.getElementById('btn-roll');
      const stage = document.getElementById('create-dice-stage');
      stage.innerHTML = '';
      rollBtn.disabled = true;
      document.getElementById('roll-result').hidden = true;
      const reveal = () => {
        document.getElementById('roll-skill').textContent = pendingStats.skill;
        document.getElementById('roll-stamina').textContent = pendingStats.stamina;
        document.getElementById('roll-charm').textContent = pendingStats.charm;
        document.getElementById('roll-result').hidden = false;
        document.getElementById('btn-to-spells').disabled = false;
        rollBtn.disabled = false;
        stage.innerHTML = '';
      };
      if (DiceFX && pendingStats.diceA != null) DiceFX.rollTwoDice(stage, pendingStats.diceA, pendingStats.diceB).then(reveal);
      else reveal();
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
      const name = spellName(key), desc = spellDesc(key);
      const row = document.createElement('div');
      row.className = 'spell-row';
      row.innerHTML = `
        <div>
          <div class="spell-name">${name}</div>
          <div class="spell-desc">${desc}</div>
        </div>
        <div class="stepper">
          <button type="button" class="minus" aria-label="Fewer ${name}">−</button>
          <span class="count" data-key="${key}">0</span>
          <button type="button" class="plus" aria-label="More ${name}">+</button>
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
          if (e.delta < 0) {
            // Narrative hazard damage (traps, rockslides, etc.) scales with
            // difficulty too, not just combat — floored at 1 so a hazard is
            // never fully harmless even on Easy.
            const mult = engine.diffCfg ? engine.diffCfg().hazardMult : 1;
            engine.damageStamina(Math.max(1, Math.round(-e.delta * mult)));
          } else {
            engine.healStamina(e.delta);
          }
        } else if (e.stat === 'skill') {
          s.skill = Math.max(1, s.skill + e.delta);
        } else if (e.stat === 'charm') {
          s.charm = Math.max(1, Math.min(12, s.charm + e.delta));
        }
      } else if (e.type === 'item') {
        const dispName = itemDisplayName(e.item.id, e.item.name);
        const ok = engine.addItem(e.item);
        if (!ok) toast(tr('packFull', dispName));
        else engine.log(tr('youTake', dispName));
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
    if (req.item) return tr('needsItem', findItemName(req.item));
    if (req.flag) return tr('needsFlag');
    if (req.anySpell) return tr('needsSpell');
    return '';
  }
  function findItemName(id) {
    const namesEn = {
      tarnished_ring: 'the tarnished ring', ember_lens: 'the ember-glass lens', skeleton_key: 'the iron key',
      guard_cloak: 'the guard cloak', silver_locket: 'the silver locket', old_ledger: "the warlock's ledger",
      brass_token: 'a brass token'
    };
    const namesRu = {
      tarnished_ring: 'потускневшее кольцо', ember_lens: 'линза тлеющего стекла', skeleton_key: 'железный ключ',
      guard_cloak: 'плащ стражника', silver_locket: 'серебряный медальон', old_ledger: 'журнал чародея',
      brass_token: 'латунный жетон'
    };
    const names = locale === 'ru' ? namesRu : namesEn;
    return names[id] || id;
  }

  function goTo(targetId, isFirst) {
    const node = getNode(targetId);
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
    const node = getNode(nodeId);
    if (!node) { console.error('Missing node on render', nodeId); return; }

    updateStatusBar();
    updateZoneBanner(nodeId);

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

  let lastZoneKey = null;
  function updateZoneBanner(nodeId) {
    const el = document.getElementById('zone-banner');
    if (!el) return;
    const zone = zoneFor(nodeId);
    if (zone === lastZoneKey) return; // keep the current banner's animation running uninterrupted
    lastZoneKey = zone;
    el.innerHTML = ZONE_BANNERS[zone] || '';
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
    box.textContent = tr('fortuneNotice');
    extraEl.appendChild(box);
    const btn = document.createElement('button');
    btn.className = 'choice-btn primary';
    btn.textContent = tr('testLuck');
    btn.addEventListener('click', () => {
      const result = engine.checkLuck();
      btn.disabled = true;
      const proceed = () => {
        toast(result.lucky ? tr('luckHolds', result.roll) : tr('luckFails', result.roll));
        updateStatusBar();
        goTo(result.lucky ? node.luckCheck.onSuccess : node.luckCheck.onFail);
      };
      if (DiceFX) DiceFX.rollDie(extraEl, result.roll).then(proceed);
      else proceed();
    });
    document.getElementById('choicebar').appendChild(btn);
  }

  function renderCharmCheck(node, extraEl) {
    const box = document.createElement('div');
    box.className = 'notice';
    box.textContent = tr('charmNotice');
    extraEl.appendChild(box);
    const btn = document.createElement('button');
    btn.className = 'choice-btn primary';
    btn.textContent = tr('persuade');
    btn.addEventListener('click', () => {
      const result = engine.checkCharm();
      btn.disabled = true;
      const proceed = () => {
        toast(result.success ? tr('charmSuccess', result.roll) : tr('charmFail', result.roll));
        updateStatusBar();
        goTo(result.success ? node.charmCheck.onSuccess : node.charmCheck.onFail);
      };
      if (DiceFX && result.diceA != null) DiceFX.rollTwoDice(extraEl, result.diceA, result.diceB).then(proceed);
      else proceed();
    });
    document.getElementById('choicebar').appendChild(btn);
  }

  function renderRiddle(node, extraEl) {
    const form = document.createElement('div');
    form.className = 'riddle-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = tr('riddlePlaceholder');
    input.autocomplete = 'off';
    const btn = document.createElement('button');
    btn.className = 'choice-btn primary';
    btn.style.flex = '0 0 auto';
    btn.textContent = tr('riddleAnswer');
    function submit() {
      // \p{L}/\p{N} (Unicode letters/numbers) so Cyrillic answers survive the strip, not just ASCII \w.
      const norm = input.value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
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
    header.textContent = tr('youHaveCoins', s.coins);
    extraEl.appendChild(header);
    SHOP_ITEMS.forEach(item => {
      const already = item.stackId ? false : engine.hasItem(item.id);
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div>
          <div class="shop-name">${shopName(item)}</div>
          <div class="shop-desc">${shopDesc(item)}</div>
          <div class="shop-cost">${tr('coinsSuffix', item.cost)}</div>
        </div>`;
      const buyBtn = document.createElement('button');
      buyBtn.className = 'buy-btn';
      buyBtn.textContent = already ? tr('owned') : tr('buy');
      buyBtn.disabled = already || s.coins < item.cost;
      buyBtn.addEventListener('click', () => {
        if (s.coins < item.cost) return;
        s.coins -= item.cost;
        if (item.permanentStat) {
          if (item.permanentStat.stat === 'skill') { s.skill += item.permanentStat.delta; s.maxSkill += item.permanentStat.delta; }
        } else if (item.stackId === 'rations') {
          const r = s.pack.find(i => i.id === 'rations');
          if (r) r.qty += item.qty; else engine.addItem({ id: 'rations', name: itemDisplayName('rations', 'Trail rations'), slots: 1, qty: item.qty, stackable: true });
        } else {
          engine.addItem({ id: item.id, name: shopName(item), slots: item.slots });
        }
        engine.saveRun();
        toast(tr('bought', shopName(item)));
        renderShop(node, extraEl);
        header.textContent = tr('youHaveCoins', s.coins);
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
    // Guards against a spell cast and an attack both mutating combat state while
    // a dice/clash animation from the other is still resolving (each re-render
    // gets its own fresh `busy` closure, so nothing needs to reset this).
    let busy = false;

    const panel = document.createElement('div');
    panel.className = 'combat-panel';

    c.enemies.forEach(en => {
      const row = document.createElement('div');
      row.className = 'enemy-row';
      const pct = Math.max(0, Math.round((en.stamina / en.maxStamina) * 100));
      let status = '';
      if (en.dead) status = tr('defeated');
      else if (en.fled) status = tr('fled');
      const effSkill = en.skill + en.skillMod;
      const sklLabel = locale === 'ru' ? 'ЛОВ' : 'SKL';
      const staLabel = locale === 'ru' ? 'СИЛ' : 'STA';
      row.innerHTML = `
        <div class="enemy-name ${en.dead ? 'dead' : ''} ${en.fled ? 'fled' : ''}">${en.name}${status}</div>
        <div class="enemy-stats">
          <span class="enemy-stat" title="${locale === 'ru' ? 'Ловкость' : 'Skill'}">${sklLabel} ${effSkill}${en.skillMod ? (en.skillMod > 0 ? ' (+' + en.skillMod + ')' : ' (' + en.skillMod + ')') : ''}</span>
          <span class="enemy-stat" title="${locale === 'ru' ? 'Сила' : 'Stamina'}">${staLabel} ${Math.max(0, en.stamina)}/${en.maxStamina}</span>
        </div>
        <div class="enemy-bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
      if (!en.dead && !en.fled && enemiesAlive(c).length > 1) {
        const tbtn = document.createElement('button');
        tbtn.className = 'enemy-target-btn' + (c.target === en.id ? ' selected' : '');
        tbtn.textContent = c.target === en.id ? tr('targeting') : tr('target');
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
      btn.textContent = tr('moveOn');
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
      chip.textContent = spellName(spellId) + ' (' + charges + ')';
      chip.disabled = charges <= 0;
      chip.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        const res = engine.combatCast(spellId, c.target);
        if (!res.ok) { toast(trMsg(res.msg)); busy = false; return; }
        c.log = c.log || [];
        c.log.push(trMsg(res.msg));
        if (res.mirror) {
          const mres = engine.resolveMirror();
          if (mres) c.log.push(trMsg(mres.msg));
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
      escBtn.textContent = tr('illusionEscapeBtn', spellName('illusion'));
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
    atk.textContent = alive.length > 1 ? tr('strikeTarget') : tr('attack');
    atk.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      atk.disabled = true;
      $all('.spell-chip', extraEl).forEach(el => { el.disabled = true; });
      const result = engine.combatRound(c.target);
      const targetResult = result.results.find(r => r.id === c.target) || result.results[0];

      const proceed = () => {
        c.log = c.log || [];
        result.results.forEach(r => {
          if (r.outcome === 'wounded') c.log.push(trMsg('You wound ' + r.name + '.'));
          else if (r.outcome === 'player-wounded') c.log.push(trMsg(r.name + ' wounds you.'));
          else if (r.outcome === 'flank') c.log.push(trMsg(r.name + ' catches you from the side.'));
          else if (r.outcome === 'parry') c.log.push(trMsg('You and ' + r.name + ' trade blows and neither lands.'));
          if (r.fled) c.log.push(trMsg(r.name + ' breaks and flees.'));
          if (r.dead && r.outcome === 'wounded') c.log.push(trMsg(r.name + ' falls.'));
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
      };

      if (DiceFX && targetResult) {
        const clashHost = document.createElement('div');
        extraEl.appendChild(clashHost);
        DiceFX.rollPowerClash(clashHost, result.playerPower, targetResult.enemyPower, { vsLabel: locale === 'ru' ? 'пр.' : 'vs' }).then(proceed);
      } else {
        proceed();
      }
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
    const plate = document.getElementById('end-plate');
    if (plate) plate.innerHTML = ENDING_BANNERS[node.ending.type] || '';
    title.textContent = node.ending.title;
    let body = node.text;
    if (node.ending.type === 'death') {
      const flavors = deathFlavorList();
      const flavor = flavors[Math.floor(Math.random() * flavors.length)];
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

    const diffKey = s.difficulty || 'normal';
    const diffLabel = (S().diffName && S().diffName[diffKey]) || diffKey;
    stats.innerHTML = tr('endStats', s.skill, s.stamina, s.maxStamina, s.charm, s.coins, diffLabel);
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
    let html = `<div class="slots-meter">${tr('slotsMeter', slots, s.packLimit, s.flask)}</div>`;
    if (!s.pack.length) html += `<div class="pack-empty">${tr('packEmpty')}</div>`;
    s.pack.forEach(item => {
      html += `<div class="pack-item"><span class="it-name">${escapeHtml(itemDisplayName(item.id, item.name))}</span>`;
      if (item.qty) html += ` <span class="it-qty">×${item.qty}</span>`;
      html += `</div>`;
    });
    packEl.innerHTML = html;
    if (s.pack.some(i => i.id === 'rations') || s.flask > 0) {
      const row = document.createElement('div');
      row.className = 'action-row';
      if (s.pack.some(i => i.id === 'rations')) {
        const b = document.createElement('button');
        b.className = 'mini-btn'; b.textContent = tr('eatRation');
        b.addEventListener('click', () => { engine.eatRation(); engine.saveRun(); updateStatusBar(); renderDrawer(); });
        row.appendChild(b);
      }
      if (s.flask > 0) {
        const b = document.createElement('button');
        b.className = 'mini-btn'; b.textContent = tr('drinkFlask');
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
      row.innerHTML = `<span>${spellName(key)}</span><span>${tr('chargesLeft', charges)}</span>`;
      spellsEl.appendChild(row);
      if (key === 'mend' && charges > 0 && !s.combat) {
        const b = document.createElement('button');
        b.className = 'mini-btn'; b.textContent = tr('castMend');
        b.addEventListener('click', () => { engine.castOutOfCombat('mend'); engine.saveRun(); updateStatusBar(); renderDrawer(); });
        row.appendChild(b);
      }
    });

    const journalEl = document.getElementById('tab-journal');
    journalEl.innerHTML = '';
    if (!s.journal.length) journalEl.innerHTML = `<div class="pack-empty">${tr('journalEmpty')}</div>`;
    s.journal.slice().reverse().forEach(line => {
      const d = document.createElement('div');
      d.className = 'journal-entry';
      d.textContent = trMsg(line);
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
