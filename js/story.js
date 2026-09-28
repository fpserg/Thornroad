// Thornroad — story graph. Original setting and characters; not derived from any source text.
// Node effect schema:
//   onEnter.effects: [{type:'stat',stat:'stamina'|'skill'|'charm',delta}, {type:'item',item:{id,name,slots,qty?,stackable?}},
//                     {type:'flag',name}, {type:'drinkFlask'}, {type:'coins',delta}]
//   choice.effects: same shape, applied the moment that choice is picked (before navigating)
//   choice.requires: {item:'id'} | {flag:'name'} | {anySpell:['id',...]}
//   choice.once: true -> hidden after first use (tracked per node+index)
(function (global) {
  'use strict';

  const STORY = {

    n1: {
      text: `The Hush swallows the road ten paces past the last fencepost, and you step into shade that no season put there. Hale's parting words still ring in your ears: find Wren, or find what became of her — the wood has crept another field's-width toward Fenhollow every week since she stopped sending word. Ahead, the track splits around an old boundary stone.`,
      choices: [
        { label: 'Take the right-hand path', to: 'n2' },
        { label: 'Take the left-hand path', to: 'n3' }
      ]
    },

    n2: {
      text: `The path climbs between two close hills, narrowing until the branches knit overhead. Loose scree rattles somewhere above you — nothing you can see, but the hillsides look recently disturbed, as if something has been waiting there a while.`,
      choices: [
        { label: 'Press on through the narrow way', to: 'lc_rockslide' },
        { label: 'Climb the right-hand slope to look first', to: 'n6' }
      ]
    },

    lc_rockslide: {
      text: `Halfway through, the rattling becomes a roar. Loose stone lets go above you on both sides at once.`,
      luckCheck: { onSuccess: 'n6', onFail: 'lc_rockslide_hurt' }
    },
    lc_rockslide_hurt: {
      text: `You're too slow reading the ground. A stone catches your shoulder and knocks you flat before the slide passes.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: -3 }] },
      choices: [{ label: 'Get up and keep moving', to: 'n6' }]
    },

    n3: {
      text: `A man lies at the edge of the road, one arm bent wrong beneath him, blood gone dark on a torn coat. He's a King's outrider by the tarnished badge at his collar — Corin, if the name stitched inside the coat is his own. He hears your step and drags himself half upright. "You're not one of theirs," he manages. "Water — please —"`,
      choices: [
        { label: 'Give him water and stay with him', to: 'n7' },
        { label: 'There’s nothing to be done — move on', to: 'n8' }
      ]
    },

    n7: {
      text: `He drinks in two long pulls and some of the fear goes out of his eyes. "Scouted too close to the Spire," he says. "Ash Knights ran me down." His breathing slows before he can say more. With his last strength he presses a tarnished ring into your palm. "Wren wore its twin. If you find her — she'll know you came from someone who tried." He doesn't speak again.`,
      onEnter: {
        effects: [
          { type: 'drinkFlask' },
          { type: 'item', item: { id: 'tarnished_ring', name: 'Tarnished ring', slots: 1 } },
          { type: 'flag', name: 'corinRing' }
        ]
      },
      choices: [{ label: 'Close his eyes and go on', to: 'n9' }]
    },
    n8: {
      text: `Whatever put him here is still close, and grief is a poor traveling companion in a place like this. You leave him to the wood and keep walking, the sound of your own steps too loud in your ears.`,
      choices: [{ label: 'Continue', to: 'n9' }]
    },

    n6: {
      text: `The high path is slower but honest — you can see the road below the whole way, empty and undisturbed. It rejoins the main track at a mossy crossroads where a standing stone leans, carved long ago with a face too worn to read.`,
      choices: [{ label: 'Continue to the crossroads', to: 'n9' }]
    },

    n9: {
      text: `You reach a crossroads. A standing stone leans here, its carved face softened by centuries of rain but still, unmistakably, watching. Local stories call these Waystones — old enough to remember the land before the Hush, and not always willing to help a stranger for nothing.`,
      choices: [
        { label: 'Speak to the stone', to: 'n10' },
        { label: 'Keep walking', to: 'n15' }
      ]
    },

    n10: {
      text: `The carved face doesn't move, but a voice comes from everywhere at once, dry as old bark. "Answer me true and I'll lend you sight. Answer me false and lend me nothing." It asks: I am taken before I am given — what am I?`,
      riddle: {
        accept: ['your word', 'a promise', 'promise', 'your promise', 'a promise you make'],
        onCorrect: 'n10_win',
        onWrong: 'n11'
      }
    },
    n10_win: {
      text: `"A promise," the stone agrees, satisfied. "Taken before it's given, yes — that's the trouble with them." Something small and cold drops into your hand: a lens of smoky glass in an iron ring. "Hold it to anything the Spire wants hidden."`,
      onEnter: { effects: [
        { type: 'item', item: { id: 'ember_lens', name: 'Ember-glass lens', slots: 1 } },
        { type: 'flag', name: 'lensGiven' }
      ] },
      choices: [{ label: 'Ask it a second question', to: 'n11' }]
    },

    n11: {
      text: `"One more, if you're not tired of losing," the stone says — or offers, if you won. It asks: The badger-folk kept a door beneath these roots since before the Spire stood. What do you leave at a threshold to be let through?`,
      riddle: {
        accept: ['a gift', 'gift', 'an offering', 'offering', 'a token', 'token'],
        onCorrect: 'n11_win',
        onWrong: 'n15'
      }
    },
    n11_win: {
      text: `The stone seems almost pleased. "A gift, at the old door under the west root-wall. Pell trades in such things, if you ask right." You mark the word Pell in memory, and the hint of a hidden way beneath the Spire's wall.`,
      onEnter: { effects: [{ type: 'flag', name: 'tunnelHint' }] },
      choices: [{ label: 'Thank the stone and move on', to: 'n15' }]
    },

    n15: {
      text: `By afternoon you smell woodsmoke and hear a cart-wheel creak. A peddler named Pell has pitched a striped awning off the road, goods laid out on a folding table as if the Hush were the most ordinary market square in Fenhollow.`,
      shop: true,
      choices: [{ label: 'Move on down the road', to: 'n16' }]
    },

    n16: {
      text: `Light fails early under the canopy. Your legs ache, and the road ahead is only a darker seam in darker trees.`,
      choices: [
        { label: 'Make camp for the night', to: 'lc_camp' },
        { label: 'Push on tired rather than lose time', to: 'n18', effects: [{ type: 'stat', stat: 'stamina', delta: -1 }] }
      ]
    },
    lc_camp: {
      text: `You bank a small fire and try to sleep. Something moves at the edge of the light more than once.`,
      luckCheck: { onSuccess: 'n16_rest', onFail: 'n17' }
    },
    n16_rest: {
      text: `Whatever it was thinks better of you. You wake stiff but rested.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: 2 }] },
      choices: [{ label: 'Break camp and continue', to: 'n18' }]
    },
    n17: {
      text: `Two gaunt figures come out of the dark at once, rags belted with good leather taken from better-fed men. Hollow-men — Fenhollow folk the Hush drove past hunger into something meaner.`,
      combat: {
        enemies: [
          { name: 'Hollow-man', skill: 6, stamina: 7 },
          { name: 'Hollow-man', skill: 5, stamina: 6 }
        ],
        allowSpells: ['quick', 'weaken', 'flame', 'mirror'],
        illusionEscape: { to: 'n18', text: `You show them a lie worth more than what little you carry, and back away while they're still arguing over it.` },
        onVictory: 'n18'
      }
    },

    n18: {
      text: `The trees thin at last onto a riverbank clearing, and there it is across the water: the Cinder Spire, black stone against a sky the wood won't let be properly blue. Between you and it, the river runs fast and cold, and a guarded bridge stands where the road ends.`,
      choices: [
        { label: 'Cross at the guarded bridge', to: 'n20' },
        { label: 'Cross the river yourself', to: 'n25', requires: { anySpell: ['swim', 'leap'] } },
        { label: 'Look for the old door under the west wall', to: 'n28', requires: { flag: 'tunnelHint' } }
      ]
    },

    n20: {
      text: `Two Ashguard hold the bridge, black iron dull with river damp. They see you before you can decide anything clever.`,
      combat: {
        enemies: [
          { name: 'Ashguard', skill: 8, stamina: 9, loyalty: 10 },
          { name: 'Ashguard', skill: 7, stamina: 8, loyalty: 9 }
        ],
        allowSpells: ['quick', 'weaken', 'flame', 'mirror'],
        onVictory: 'n30'
      }
    },

    n25: {
      text: `You slip into the current well upstream of the bridge and let the spell carry you across, the Spire's lights sliding past in the dark water below.`,
      onEnter: { effects: [{ type: 'flag', name: 'stealthy' }] },
      luckCheck: { onSuccess: 'n30', onFail: 'n25_caught' }
    },
    n25_caught: {
      text: `You come up the far bank straight into a river patrol.`,
      combat: {
        enemies: [{ name: 'Ashguard scout', skill: 7, stamina: 8, loyalty: 8 }],
        allowSpells: ['quick', 'weaken', 'flame', 'mirror'],
        illusionEscape: { to: 'n30', text: `The scout blinks at something that was never there, and you're past him and into the courtyard before the confusion clears.` },
        onVictory: 'n30'
      }
    },

    n28: {
      text: `Beneath a fall of west-wall roots you find a door no taller than your knee, old badger-carvings worn into the frame. Following the Waystone's word, you leave a coin gift at the threshold and knock. The door opens on a passage exactly wide enough, and something unseen guides you under the wall in near-total dark, out again inside the courtyard before you've had time to be properly afraid.`,
      onEnter: { effects: [
        { type: 'coins', delta: -3 },
        { type: 'flag', name: 'stealthy' },
        { type: 'flag', name: 'tunnelUsed' }
      ] },
      choices: [{ label: 'Rise into the courtyard', to: 'n30' }]
    },

    n30: {
      text: `The courtyard of the Cinder Spire is quieter than you expected — a keep door dead ahead, a squat barracks to your right, and a low shrine-house to your left, its roof sagging under moss.`,
      choices: [
        { label: 'Search the barracks', to: 'n33', once: true },
        { label: 'Look into the shrine-house', to: 'n34', once: true },
        { label: 'Go to the keep door', to: 'n32' }
      ]
    },

    n33: {
      text: `A single Ashguard dozes over a half-empty cup, boots up on a table stacked with requisitions.`,
      choices: [
        { label: 'Slip past quietly and search', to: 'n33_sneak' },
        { label: 'Just fight him now, before he wakes on his own', to: 'n33_wake' }
      ]
    },
    n33_sneak: {
      text: `You ease along the wall, weight on your toes, watching the sleeper's breathing for any change in its rhythm.`,
      charmCheck: { onSuccess: 'n33_loot', onFail: 'n33_wake' }
    },
    n33_wake: {
      text: `A board gives under your foot and he's up with a shout before you've finished cursing your luck.`,
      combat: {
        enemies: [{ name: 'Ashguard', skill: 7, stamina: 8, loyalty: 9 }],
        allowSpells: ['quick', 'weaken', 'flame', 'mirror'],
        onVictory: 'n33_loot'
      }
    },
    n33_loot: {
      text: `Under a loose floorboard you find a plain iron key and, folded with it, a spare guard's cloak — black wool, the Spire's crest stitched crooked by someone who didn't much care.`,
      onEnter: { effects: [
        { type: 'item', item: { id: 'skeleton_key', name: 'Iron key', slots: 1 } },
        { type: 'item', item: { id: 'guard_cloak', name: 'Guard cloak', slots: 1 } }
      ] },
      choices: [{ label: 'Return to the courtyard', to: 'n30_back' }]
    },

    n34: {
      text: `Dust and old candle-wax. A stone figure stands where an altar should be, features worn nearly featureless, not unlike the Waystone on the road. When you step close, the same dry voice speaks from it. "One more riddle, traveler, if you've the patience." It asks: I have no lock, yet only the right face opens me.`,
      riddle: { accept: ['a face', 'face', 'your face', 'recognition', 'a locket', 'locket'], onCorrect: 'n34_win', onWrong: 'n34_lose' }
    },
    n34_win: {
      text: `"Just so," the voice says, and a locket on a tarnished chain appears in the dust at the statue's feet, a woman's likeness worked into the silver in careful, loving lines. This must be Wren. "Show it to what still remembers her," the voice adds, and falls silent for good.`,
      onEnter: { effects: [
        { type: 'item', item: { id: 'silver_locket', name: 'Silver locket', slots: 1 } },
        { type: 'flag', name: 'locketGiven' }
      ] },
      choices: [{ label: 'Return to the courtyard', to: 'n30_back' }]
    },
    n34_lose: {
      text: `The statue's voice fades without another word, whatever it might have given you kept for someone who answers better.`,
      choices: [{ label: 'Return to the courtyard', to: 'n30_back' }]
    },
    n30_back: {
      text: `You return to the courtyard. The keep door still waits ahead of you.`,
      choices: [{ label: 'Go to the keep door', to: 'n32' }]
    },

    n32: {
      text: `An Ash Knight captain stands the keep threshold alone, black plate scored with old fighting, longsword already loose in its scabbard.`,
      choices: [
        { label: 'Bluff past in the guard cloak', to: 'n32_bluff', requires: { item: 'guard_cloak' } },
        { label: 'Fight your way through', to: 'n32_fight' }
      ]
    },
    n32_bluff: {
      text: `You settle the cloak on your shoulders and walk straight at him, unhurried, the way you imagine someone who belongs here would walk.`,
      charmCheck: { onSuccess: 'n40', onFail: 'n32_bluff_fail' }
    },
    n32_bluff_fail: {
      text: `He looks at you a beat too long, then at the cloak's crooked stitching, and his sword is already moving.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: -2 }] },
      choices: [{ label: 'Fight', to: 'n32_fight' }]
    },
    n32_fight: {
      text: `There's no talking to this one. He comes at you like the door behind him is the only thing worth defending in the world.`,
      combat: {
        enemies: [{ name: 'Ash Knight captain', skill: 10, stamina: 12, loyalty: 14, dmg: 2 }],
        allowSpells: ['quick', 'weaken', 'flame', 'mirror'],
        onVictory: 'n40'
      }
    },

    n40: {
      text: `The great hall beyond is cold and much too large for the handful of torches trying to light it. Doorways lead off in three directions, and a stairway falls away into darkness on your left.`,
      choices: [
        { label: 'Try the side door (library)', to: 'n41', once: true },
        { label: 'Examine the old painting on the wall', to: 'n44', once: true },
        { label: 'Descend the stairs', to: 'n43' }
      ]
    },

    n41: {
      text: `Shelves of ledgers line a narrow room, dust thick enough to write in. Most of it is tax rolls and requisition orders, but one ledger stands out, bound in unmarked leather and shoved to the back of a low shelf.`,
      choices: [{ label: 'Read it', to: 'n41_read' }]
    },
    n41_read: {
      text: `It's Vail Thorne's own hand — notes on wards, on a captive he calls only "the cartographer," and, near the end, a warning to himself in smaller, angrier writing: never wake her from the right. You commit that much to memory and close the book.`,
      onEnter: { effects: [
        { type: 'item', item: { id: 'old_ledger', name: "Warlock's ledger", slots: 1 } },
        { type: 'flag', name: 'ledgerRead' }
      ] },
      choices: [{ label: 'Return to the hall', to: 'n40_back' }]
    },
    n44: {
      text: `The painting shows a battle that never happened here — black-armored riders burning a village that looks uncomfortably like Fenhollow's own outskirts. The longer you look, the more the smoke in it seems to move.`,
      luckCheck: { onSuccess: 'n44_safe', onFail: 'n44_hurt' }
    },
    n44_safe: {
      text: `You step back before whatever's watching through the paint notices you noticing.`,
      choices: [{ label: 'Return to the hall', to: 'n40_back' }]
    },
    n44_hurt: {
      text: `A painted archer's arrow finds you exactly as if it were real. It is, for just long enough to hurt.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: -3 }] },
      choices: [{ label: 'Back away and return to the hall', to: 'n40_back' }]
    },
    n40_back: {
      text: `You return to the great hall.`,
      choices: [{ label: 'Descend the stairs', to: 'n43' }]
    },

    n43: {
      text: `The stairs turn twice before the air changes — colder, wetter, older. Cells line the passage ahead, most empty, one holding something that shifts at your approach.`,
      choices: [{ label: 'Go to the last cell', to: 'n45' }]
    },
    n45: {
      text: `In the last cell, curled in straw, is a great black hound, too still and too clear-eyed for an ordinary animal. It watches you without fear.`,
      choices: [
        { label: 'Show it the silver locket', to: 'n45_locket', requires: { item: 'silver_locket' } },
        { label: 'Move on without disturbing it', to: 'lc_flagstone' }
      ]
    },
    n45_locket: {
      text: `The hound's ears go up at the little silver face, and for a moment something almost like grief crosses it. "She fed me, when they let her," it says, in a voice like gravel underwater. "Three doors wait ahead. Left is a drop with no bottom. Right is a room that burns what enters. Only the middle door still remembers being kind." It puts its head back down, spent by the effort of speaking at all.`,
      onEnter: { effects: [{ type: 'flag', name: 'doorHint' }] },
      choices: [{ label: 'Go on', to: 'lc_flagstone' }]
    },
    lc_flagstone: {
      text: `Further on, a flagstone sits fractionally higher than its neighbors — the kind of thing you only notice if you're already afraid of noticing too late.`,
      luckCheck: { onSuccess: 'n46', onFail: 'lc_flagstone_hurt' }
    },
    lc_flagstone_hurt: {
      text: `You feel it give a half-second too late. A needle-thin dart takes you in the calf before you can pull free — not deep, but it burns.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: -2 }] },
      choices: [{ label: 'Limp onward', to: 'n46' }]
    },

    n46: {
      text: `Three doors close the passage: left, middle, right, each iron-bound and identical but for the smell of the air beneath them.`,
      choices: [
        { label: 'Open the left door', to: 'n46_left' },
        { label: 'Open the middle door', to: 'n46_mid' },
        { label: 'Open the right door', to: 'n46_right' },
        { label: 'Study the doors with the ember-glass lens', to: 'n46_lens', requires: { item: 'ember_lens' }, once: true }
      ]
    },
    n46_lens: {
      text: `Through the smoked glass, faint runes swim into view on the middle door alone: a ward meant to be walked through, not around.`,
      choices: [
        { label: 'Open the left door', to: 'n46_left' },
        { label: 'Open the middle door', to: 'n46_mid' },
        { label: 'Open the right door', to: 'n46_right' }
      ]
    },
    n46_left: {
      text: `The left door opens on nothing at all — a black drop with no far wall you can find. You catch the frame just in time, heart slamming, and haul yourself back before the pull of it decides the matter for you.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: -4 }] },
      choices: [{ label: 'Try another door', to: 'n46' }]
    },
    n46_right: {
      text: `Heat rolls out the instant the right door cracks open — a room built to burn whatever crosses its threshold. You slam it shut, singed and coughing.`,
      onEnter: { effects: [{ type: 'stat', stat: 'stamina', delta: -4 }] },
      choices: [{ label: 'Try another door', to: 'n46' }]
    },
    n46_mid: {
      text: `The middle door opens easy and kind, like it's been waiting for someone who deserved to find it. Beyond is a narrow stair down, candlelight at the bottom.`,
      choices: [{ label: 'Descend', to: 'n50' }]
    },

    n50: {
      text: `The lowest chamber of the Cinder Spire is small and close and far too warm. On a dais of black glass, Wren sleeps — no mark on her, only the terrible stillness of it — while a thin man in gray-black robes waits beside her, unsurprised, as if he's rehearsed this moment many times. "You're the eighth," says Vail Thorne. "The others were quicker to draw steel."`,
      choices: [
        { label: 'Try to reason with him', to: 'n50_talk', once: true },
        { label: 'Waste no more words — attack', to: 'n51' },
        { label: 'Grab Wren and run for it', to: 'n50_flee', requires: { flag: 'stealthy' } }
      ]
    },
    n50_talk: {
      text: `"You don't have to keep her," you say, playing for time as much as anything else. "Whatever she found — I don't care about it. Let her go and I walk out of here."`,
      charmCheck: { onSuccess: 'n50_stalled', onFail: 'n51' }
    },
    n50_stalled: {
      text: `Something in what you say — or simply your steadiness in saying it — makes him hesitate half a second too long, weighing you instead of moving. It's not much. It might be enough.`,
      onEnter: { effects: [{ type: 'flag', name: 'firstStrike' }] },
      choices: [{ label: 'Attack while he is still weighing you', to: 'n51' }]
    },
    n50_flee: {
      text: `You cross the room in a rush, get an arm under Wren before Thorne fully registers what you mean to do, and half-carry, half-drag her back up the stair the way you came. He doesn't chase — he doesn't need to; the Hush will do that for him. You make the courtyard, the gate, the river, moving faster than any two people carrying a third have a right to. By the time you reach Fenhollow's walls, Wren has begun, faintly, to stir. She wakes fully three days later, the Spire's grip on her broken by distance more than by anything you did. The Hush stops advancing, but it doesn't recede either. Vail Thorne is still in his tower, and somewhere past the tree-line the wood waits, patient, for the next thing it wants.`,
      ending: { type: 'retreat', title: 'A Narrow Mercy' }
    },

    n51: {
      text: `Vail Thorne doesn't reach for a weapon — he doesn't need one. The air around him thickens, and whatever spell you're most proud of suddenly feels like it belongs to him instead.`,
      combat: {
        enemies: [{ name: 'Vail Thorne', skill: 9, stamina: 16, loyalty: null, dmg: 2 }],
        allowSpells: ['quick', 'weaken', 'flame', 'mirror'],
        mirrorCurseRound1: true,
        onVictory: 'n60'
      }
    },

    n60: {
      text: `Vail Thorne goes down without theatrics, the black glass dais dimming the instant he stops breathing. You cross to Wren, and — without quite knowing why it matters, only that it does — approach her from the left. Her eyes open on the second try, focusing on you with a scout's habit of checking the exits before anything else. "Fenhollow sent you," she says. Not quite a question. Outside, for the first time since you entered it, the Hush is holding still — and by the time you reach the tree-line together, it has begun, very slowly, to pull back.`,
      ending: { type: 'victory', title: 'What the Wood Gave Back' }
    },

    ending_death: {
      text: `The Hush keeps what it takes. Your part in this story ends here, unfinished, and somewhere in Fenhollow a lantern will be left burning a while longer than it should.`,
      ending: { type: 'death', title: 'The Wood Keeps Its Own' }
    }
  };

  const DEATH_FLAVOR = [
    'The last thing you see is canopy, very far overhead, and no sky past it at all.',
    'Somewhere behind you, unhurried, footsteps stop being in any hurry to follow.',
    'The Hush is patient about this part. It has had a great deal of practice.',
    'Fenhollow will wait for a letter that was never going to come.'
  ];

  const SHOP_ITEMS = [
    { id: 'brass_token', name: 'Brass token', cost: 5, desc: 'Said to open old doors that answer to gifts, not force.', slots: 1 },
    { id: 'whetstone', name: 'Whetstone', cost: 4, desc: 'Keeps an edge true. Permanently +1 Skill.', slots: 0, permanentStat: { stat: 'skill', delta: 1 } },
    { id: 'rations_bundle', name: 'Extra rations (x2)', cost: 3, desc: 'Two more trail rations, +4 Stamina each when eaten.', slots: 0, stackId: 'rations', qty: 2 }
  ];

  global.Thornroad = global.Thornroad || {};
  global.Thornroad.STORY = STORY;
  global.Thornroad.SHOP_ITEMS = SHOP_ITEMS;
  global.Thornroad.DEATH_FLAVOR = DEATH_FLAVOR;
  global.Thornroad.START_NODE = 'n1';
})(window);
