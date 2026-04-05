// js/storySystem.js — Narrative Story Progression for Demonfall

(function () {
  'use strict';

  // ---- Act Definitions ----
  const STORY_ACTS = [
    { id: 'awakening',   name: 'Erwachen',                 triggerWave: 1,  triggerQuests: 0 },
    { id: 'obedience',   name: 'Gehorsam und Erinnerung',  triggerWave: 10, triggerQuests: 1 },
    { id: 'descent',     name: 'Der Abstieg',              triggerWave: 20, triggerQuests: 2 },
    { id: 'rebellion',   name: 'Rebellion',                triggerWave: 30, triggerQuests: 3 },
    { id: 'revelation',  name: 'Offenbarung',              triggerWave: 40, triggerQuests: 3 }
  ];

  // ---- Narrative texts shown at act transitions ----
  const ACT_NARRATIVES = {
    awakening:  'Du erwachst in der Archivschmiede. Etwas stimmt nicht mit deinen Erinnerungen...',
    obedience:  'Die Auftraege des Rates werden seltsamer. Branka fluestert von verbotenen Protokollen...',
    descent:    'Unter dem Rathaus verbirgt sich mehr als alte Akten. Daemonische Siegel leuchten in der Dunkelheit...',
    rebellion:  'Die Druckerpresse laeuft. Thoms Pamphlete verbreiten sich in der Stadt...',
    revelation: 'Die letzte Illusion des Kettenrats zerbricht. Licht durchdringt den Nebel...'
  };

  // ---- Dynamic NPC dialogue per act ----
  const NPC_DIALOGUE = {
    branka: {
      awakening: [
        'Stahl allein schneidet die Luegen des Rates nicht. Erst wenn jede Klinge Wissen traegt, faellt ihre Maske.',
        'Im Keller unter dem Rathaus lagern Protokolle aus Daemonenverhoeren. Bring mir Abschriften, und ich veredele deine Artefakte.',
        'Sprich draussen leise. Die Aufseher des Kettenrats tragen inzwischen die Farben der Stadtgarde.'
      ],
      obedience: [
        'Deine Fortschritte sind bemerkenswert. Die alten Protokolle enthalten mehr, als der Rat zugeben will.',
        'Ich habe verbotene Schmiedetechniken gefunden. Die Daemonen selbst haben sie einst gelehrt.',
        'Der Rat verbietet bestimmte Legierungen. Frag dich, warum.'
      ],
      descent: [
        'Die Siegel unter dem Rathaus pulsieren staerker. Jemand fuettert sie mit Angst.',
        'Ich schmiede jetzt im Verborgenen. Der Rat darf nichts von den neuen Klingen erfahren.',
        'Jede Waffe, die ich fertige, traegt ein Zeichen des Widerstands.'
      ],
      rebellion: [
        'Die Rebellion braucht Waffen. Ich schmiede Tag und Nacht.',
        'Thoms Pamphlete haben die Buerger wachgeruettelt. Jetzt brauchen sie Stahl, nicht nur Worte.',
        'Der Kettenrat schickt Haescher. Aber unsere Klingen sind schaerfer als ihre Ketten.'
      ],
      revelation: [
        'Die letzte Schmiede ist vollendet. Diese Klinge wird den Nebel zerschneiden.',
        'Fogreach erwacht. Nach all den Jahren sehen die Menschen endlich klar.',
        'Was auch geschieht — die Archivschmiede wird nie wieder schweigen.'
      ]
    },
    thom: {
      awakening: [
        'Der Kettenrat verordnet Gebete, Mahlzeiten, sogar Traeume. Wir antworten mit Pamphleten voller Namen und Zahlen.',
        'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll.',
        'Verteile nichts Ungeprueftes. Eine falsche Zeile, und sie sperren wieder zehn Familien ein.'
      ],
      obedience: [
        'Die ersten Beweise sind erschuetternd. Der Rat hat Daemonen nicht verbannt — er hat sie eingeladen.',
        'Meine Druckerpresse laeuft heiss. Die Wahrheit will ans Licht.',
        'Jedes Dokument, das du findest, ist eine Kugel gegen die Luegen des Rates.'
      ],
      descent: [
        'Unter dem Rathaus gibt es Kammern, die auf keiner Karte stehen. Was verbergen sie dort?',
        'Die Druckerpresse braucht mehr Tinte. Die Wahrheit ist umfangreicher als gedacht.',
        'Ich drucke jetzt auch Karten der unterirdischen Gaenge. Mara liefert die Skizzen.'
      ],
      rebellion: [
        'Die Pamphlete verbreiten sich wie Feuer! Ganz Fogreach liest unsere Wahrheiten.',
        'Der Rat hat meine alte Presse zerstoert. Aber ich habe laengst drei neue versteckt.',
        'Die Buerger kommen nachts zur Druckerei. Sie wollen helfen. Die Rebellion waechst.'
      ],
      revelation: [
        'Die letzte Ausgabe geht in Druck. Sie enthaelt alles — jeden Namen, jedes Siegel, jede Luege.',
        'Fogreach wird nie wieder vergessen. Die Wahrheit ist jetzt unauslöschlich.',
        'Wenn das hier vorbei ist, drucke ich Geschichtsbuecher. Keine Pamphlete mehr noetig.'
      ]
    },
    mara: {
      awakening: [
        'Die Schreiber des Rates markieren Haeuser mit Kreideketten. Wer widerspricht, verschwindet in Ritualschachten.',
        'Der Zeremonienmeister besitzt neue Siegel. Sie holen Daemonen als stilles Archiv.',
        'Sichere Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.'
      ],
      obedience: [
        'Meine Spaeher haben neue Gaenge unter dem Rathaus entdeckt. Die Siegel werden staerker.',
        'Der Zeremonienmeister wechselt seine Routen. Er ahnt, dass wir ihm folgen.',
        'Jedes gebrochene Siegel schwaecht seinen Griff. Mach weiter.'
      ],
      descent: [
        'Die unterirdischen Gaenge fuehren tiefer als gedacht. Dort unten lebt etwas.',
        'Ich habe Karten gezeichnet. Die Siegel bilden ein Muster — ein Beschwörungskreis unter der ganzen Stadt.',
        'Wir muessen vorsichtig sein. Der Zeremonienmeister weiss, dass wir kommen.'
      ],
      rebellion: [
        'Mein Netzwerk ist aktiv. Spaeher in jedem Viertel, Augen an jeder Ecke.',
        'Die unterirdischen Routen sind jetzt unsere Versorgungswege. Der Rat kontrolliert die Strassen, wir den Untergrund.',
        'Der Zeremonienmeister hat seine letzten Siegel aktiviert. Es ist fast soweit.'
      ],
      revelation: [
        'Alle Siegel sind kartiert. Der Beschwörungskreis kann gebrochen werden.',
        'Meine Spaeher melden Licht in den Tunneln. Der Nebel lichtet sich.',
        'Fogreach gehoert wieder den Menschen. Nicht den Ketten. Nicht den Daemonen.'
      ]
    }
  };

  // ---- Wave Milestone Events ----
  const WAVE_MILESTONES = {
    10: 'Die ersten Siegel sind gebrochen. Branka wartet auf deinen Bericht.',
    20: 'Tief unter dem Rathaus findest du Beweise fuer die Rituale des Kettenrats.',
    30: 'Der Schattenrat ist gefallen. Die Wahrheit kann nicht mehr verborgen werden.'
  };

  // ---- Special Ending Text ----
  const ALL_QUESTS_ENDING = 'Die Ketten von Fogreach sind gebrochen.\n\nDie Druckerpresse verbreitet die Wahrheit.\nDie Schmiede haemmert fuer die Freiheit.\nDas Untergrund-Netzwerk wacht.\n\nDu hast die Stadt befreit.';

  // ---- Story State ----
  let storyState = {
    currentActIndex: 0,
    highestWave: 0,
    eventsSeen: [],       // act IDs whose narrative overlay has been shown
    pendingEvent: null,   // act ID to show on next hub visit
    pendingMilestone: null, // wave milestone to show on next hub visit
    milestonesShown: [],  // wave numbers whose milestones have been shown
    endingShown: false,   // whether the all-quests-complete ending has been shown
    totalKills: 0,
    totalRoomsCleared: 0,
    totalWavesSurvived: 0
  };

  // ---- Core Functions ----

  function getCurrentAct() {
    return STORY_ACTS[storyState.currentActIndex] || STORY_ACTS[0];
  }

  function getCurrentActIndex() {
    return storyState.currentActIndex;
  }

  function getActById(actId) {
    return STORY_ACTS.find(function (a) { return a.id === actId; });
  }

  /**
   * Compute which act the player should be in based on wave + quests.
   * Returns the index into STORY_ACTS.
   */
  function _computeActIndex(highestWave, completedQuestCount) {
    var idx = 0;
    for (var i = STORY_ACTS.length - 1; i >= 0; i--) {
      var act = STORY_ACTS[i];
      if (highestWave >= act.triggerWave && completedQuestCount >= act.triggerQuests) {
        idx = i;
        break;
      }
    }
    return idx;
  }

  function _getCompletedQuestCount() {
    if (window.questSystem && typeof window.questSystem.getCompletedQuests === 'function') {
      return window.questSystem.getCompletedQuests().length;
    }
    return 0;
  }

  /**
   * Called after a wave is completed. Updates highest wave and checks for act transitions.
   * Returns true if a new act was reached.
   */
  function onWaveCompleted(waveNumber) {
    var wave = Math.max(1, waveNumber || 0);
    if (wave > storyState.highestWave) {
      storyState.highestWave = wave;
    }
    storyState.totalWavesSurvived = (storyState.totalWavesSurvived || 0) + 1;

    // Check for wave milestones
    if (WAVE_MILESTONES[wave] && storyState.milestonesShown.indexOf(wave) === -1) {
      storyState.pendingMilestone = wave;
      console.log('[StorySystem] Wave milestone queued: ' + wave);
    }

    var completedQuests = _getCompletedQuestCount();
    var newActIndex = _computeActIndex(storyState.highestWave, completedQuests);

    if (newActIndex > storyState.currentActIndex) {
      var newAct = STORY_ACTS[newActIndex];
      storyState.currentActIndex = newActIndex;

      // Only queue the event if not already seen
      if (storyState.eventsSeen.indexOf(newAct.id) === -1) {
        storyState.pendingEvent = newAct.id;
      }
      console.log('[StorySystem] Act transition -> ' + newAct.name + ' (Act ' + (newActIndex + 1) + ')');
      return true;
    }
    return false;
  }

  /**
   * Track enemy kill for stats.
   */
  function onEnemyKilled() {
    storyState.totalKills = (storyState.totalKills || 0) + 1;
  }

  /**
   * Track room cleared for stats.
   */
  function onRoomCleared() {
    storyState.totalRoomsCleared = (storyState.totalRoomsCleared || 0) + 1;
  }

  /**
   * Check for pending story events (call on hub create).
   * Returns { actId, actName, narrative } or null.
   */
  function consumePendingEvent() {
    // Priority 1: Act transitions
    if (storyState.pendingEvent) {
      var actId = storyState.pendingEvent;
      storyState.pendingEvent = null;
      storyState.eventsSeen.push(actId);

      var act = getActById(actId);
      return {
        actId: actId,
        actName: act ? act.name : actId,
        actNumber: act ? STORY_ACTS.indexOf(act) + 1 : 0,
        narrative: ACT_NARRATIVES[actId] || ''
      };
    }

    // Priority 2: Wave milestones
    if (storyState.pendingMilestone) {
      var wave = storyState.pendingMilestone;
      storyState.pendingMilestone = null;
      storyState.milestonesShown.push(wave);

      return {
        actId: 'milestone_' + wave,
        actName: 'Welle ' + wave + ' bezwungen',
        actNumber: null,
        narrative: WAVE_MILESTONES[wave] || ''
      };
    }

    // Priority 3: All quest chains complete ending
    if (!storyState.endingShown && window.questSystem && typeof window.questSystem.areAllQuestChainsComplete === 'function') {
      if (window.questSystem.areAllQuestChainsComplete()) {
        storyState.endingShown = true;
        return {
          actId: 'ending',
          actName: 'Epilog',
          actNumber: null,
          narrative: ALL_QUESTS_ENDING
        };
      }
    }

    return null;
  }

  /**
   * Get dynamic NPC dialogue lines for current act.
   */
  function getNpcDialogue(npcId) {
    var act = getCurrentAct();
    var npcLines = NPC_DIALOGUE[npcId];
    if (!npcLines) return null;
    return npcLines[act.id] || npcLines.awakening || null;
  }

  // ---- Journal Data ----

  function getJournalData() {
    var act = getCurrentAct();
    var completedQuests = [];
    var activeQuests = [];

    if (window.questSystem) {
      completedQuests = window.questSystem.getCompletedQuests().map(function (q) {
        var rewardStr = '';
        if (q.rewards) {
          var parts = [];
          if (q.rewards.xp) parts.push(q.rewards.xp + ' XP');
          if (q.rewards.materials && q.rewards.materials.MAT) parts.push(q.rewards.materials.MAT + ' Eisenbrocken');
          if (q.rewards.items && q.rewards.items.length > 0) parts.push(q.rewards.items[0].name);
          if (q.rewards.unlocks) {
            q.rewards.unlocks.forEach(function (u) {
              if (u === 'enhanced_crafting') parts.push('Erweiterte Schmiede');
              else if (u === 'xp_bonus_10') parts.push('+10% XP');
              else if (u === 'shadow_skill') parts.push('Schattenkunst');
              else if (u === 'story_ending') parts.push('Epilog');
              else parts.push(u);
            });
          }
          rewardStr = parts.join(', ');
        }
        return { title: q.title, description: q.description, rewards: rewardStr, npcId: q.npcId };
      });
      activeQuests = window.questSystem.getActiveQuests().map(function (q) {
        var obj = q.objectives[0];
        var progress = obj ? (obj.current + '/' + obj.required) : '';
        var progressPct = obj ? Math.floor((obj.current / obj.required) * 100) : 0;
        return { title: q.title, description: q.description, progress: progress, progressPct: progressPct, npcId: q.npcId };
      });
    }

    return {
      actNumber: storyState.currentActIndex + 1,
      actName: act.name,
      actNarrative: ACT_NARRATIVES[act.id] || '',
      highestWave: storyState.highestWave,
      completedQuests: completedQuests,
      activeQuests: activeQuests,
      totalActs: STORY_ACTS.length,
      totalKills: storyState.totalKills || 0,
      totalRoomsCleared: storyState.totalRoomsCleared || 0,
      totalWavesSurvived: storyState.totalWavesSurvived || 0
    };
  }

  // ---- Persistence ----

  function getStorySaveData() {
    return {
      currentActIndex: storyState.currentActIndex,
      highestWave: storyState.highestWave,
      eventsSeen: storyState.eventsSeen.slice(),
      pendingEvent: storyState.pendingEvent,
      pendingMilestone: storyState.pendingMilestone || null,
      milestonesShown: (storyState.milestonesShown || []).slice(),
      endingShown: storyState.endingShown || false,
      totalKills: storyState.totalKills || 0,
      totalRoomsCleared: storyState.totalRoomsCleared || 0,
      totalWavesSurvived: storyState.totalWavesSurvived || 0
    };
  }

  function loadStorySaveData(data) {
    if (!data || typeof data !== 'object') return;
    storyState.currentActIndex = typeof data.currentActIndex === 'number' ? data.currentActIndex : 0;
    storyState.highestWave = typeof data.highestWave === 'number' ? data.highestWave : 0;
    storyState.eventsSeen = Array.isArray(data.eventsSeen) ? data.eventsSeen.slice() : [];
    storyState.pendingEvent = data.pendingEvent || null;
    storyState.pendingMilestone = data.pendingMilestone || null;
    storyState.milestonesShown = Array.isArray(data.milestonesShown) ? data.milestonesShown.slice() : [];
    storyState.endingShown = !!data.endingShown;
    storyState.totalKills = typeof data.totalKills === 'number' ? data.totalKills : 0;
    storyState.totalRoomsCleared = typeof data.totalRoomsCleared === 'number' ? data.totalRoomsCleared : 0;
    storyState.totalWavesSurvived = typeof data.totalWavesSurvived === 'number' ? data.totalWavesSurvived : 0;
  }

  // ---- Story Overlay UI (Phaser scene method) ----

  /**
   * Show a full-screen narrative overlay. Call on a Phaser scene.
   * @param {Phaser.Scene} scene
   * @param {object} eventData - { actName, actNumber, narrative }
   * @param {function} [onDismiss] - callback when overlay is dismissed
   */
  function showStoryOverlay(scene, eventData, onDismiss) {
    if (!scene || !eventData) return;

    var cam = scene.cameras.main;
    var w = cam.width;
    var h = cam.height;

    var overlay = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 0.85)
      .setDepth(6000)
      .setScrollFactor(0);

    var container = scene.add.container(w / 2, h / 2).setDepth(6001).setScrollFactor(0);

    // Act number label (only for act transitions, not milestones)
    var actLabelStr = eventData.actNumber ? ('Akt ' + eventData.actNumber) : 'Meilenstein';
    var actLabel = scene.add.text(0, -80, actLabelStr, {
      fontFamily: 'serif',
      fontSize: 22,
      color: '#a89878'
    }).setOrigin(0.5);
    container.add(actLabel);

    // Act title in gold
    var titleText = scene.add.text(0, -40, eventData.actName, {
      fontFamily: 'serif',
      fontSize: 38,
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(titleText);

    // Divider line
    var divider = scene.add.graphics();
    divider.lineStyle(1, 0xffd700, 0.5);
    divider.lineBetween(-200, 0, 200, 0);
    container.add(divider);

    // Narrative text in parchment color
    var narrativeText = scene.add.text(0, 40, eventData.narrative, {
      fontFamily: 'serif',
      fontSize: 20,
      color: '#f1e9d8',
      wordWrap: { width: 500 },
      lineSpacing: 6,
      align: 'center'
    }).setOrigin(0.5, 0);
    container.add(narrativeText);

    // Dismiss hint
    var hintText = scene.add.text(0, narrativeText.y + narrativeText.height + 50, 'Weiter [LEERTASTE]', {
      fontFamily: 'monospace',
      fontSize: 16,
      color: '#888888'
    }).setOrigin(0.5);
    container.add(hintText);

    // Blink the hint
    scene.tweens.add({
      targets: hintText,
      alpha: { from: 1, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    var dismissed = false;
    var dismiss = function () {
      if (dismissed) return;
      dismissed = true;
      overlay.destroy();
      container.destroy(true);
      if (typeof onDismiss === 'function') onDismiss();
    };

    scene.input.keyboard.once('keydown-SPACE', dismiss);
    scene.input.keyboard.once('keydown-ENTER', dismiss);
    scene.input.keyboard.once('keydown-ESC', dismiss);
    scene.time.delayedCall(500, function () {
      overlay.setInteractive();
      overlay.once('pointerdown', dismiss);
    });
  }

  // ---- Journal Overlay UI ----

  /**
   * Show story journal overlay. Call on a Phaser scene.
   * @param {Phaser.Scene} scene
   * @param {function} [onClose] - callback when closed
   */
  function showJournalOverlay(scene, onClose) {
    if (!scene) return;

    var data = getJournalData();
    var cam = scene.cameras.main;
    var w = cam.width;
    var h = cam.height;

    var overlay = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 0.8)
      .setDepth(6000)
      .setScrollFactor(0)
      .setInteractive();

    var panelW = 560;
    var panelH = 580;
    var pad = 24;

    var container = scene.add.container(w / 2, h / 2).setDepth(6001).setScrollFactor(0);

    var bg = scene.add.graphics();
    bg.fillStyle(0x0c0c14, 0.95).fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    bg.lineStyle(2, 0x484850, 0.9).strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    container.add(bg);

    var y = -panelH / 2 + pad;
    var innerW = panelW - pad * 2;
    var leftX = -panelW / 2 + pad;

    // Title
    var title = scene.add.text(0, y, 'Tagebuch', {
      fontFamily: 'serif',
      fontSize: 26,
      color: '#ffd700'
    }).setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 14;

    // Current act
    var actInfo = scene.add.text(leftX, y,
      'Akt ' + data.actNumber + ' von ' + data.totalActs + ': ' + data.actName, {
      fontFamily: 'serif',
      fontSize: 18,
      color: '#f1e9d8'
    }).setOrigin(0, 0);
    container.add(actInfo);
    y += actInfo.height + 6;

    // Act narrative
    var narrative = scene.add.text(leftX, y, data.actNarrative, {
      fontFamily: 'serif',
      fontSize: 14,
      color: '#a89878',
      wordWrap: { width: innerW },
      fontStyle: 'italic',
      lineSpacing: 3
    }).setOrigin(0, 0);
    container.add(narrative);
    y += narrative.height + 14;

    // Stats bar
    var statsStr = 'Hoechste Welle: ' + data.highestWave
      + '  |  Gegner besiegt: ' + data.totalKills
      + '  |  Raeume: ' + data.totalRoomsCleared
      + '  |  Wellen: ' + data.totalWavesSurvived;
    var statsText = scene.add.text(leftX, y, statsStr, {
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#8a8a9a'
    }).setOrigin(0, 0);
    container.add(statsText);
    y += statsText.height + 14;

    // Divider
    var divGfx = scene.add.graphics();
    divGfx.lineStyle(1, 0x484850, 0.6);
    divGfx.lineBetween(leftX, y, leftX + innerW, y);
    container.add(divGfx);
    y += 10;

    // Active quests with progress bars
    var activeHeader = scene.add.text(leftX, y, 'Aktive Aufgaben:', {
      fontFamily: 'serif',
      fontSize: 16,
      color: '#88bbff'
    }).setOrigin(0, 0);
    container.add(activeHeader);
    y += activeHeader.height + 6;

    if (data.activeQuests.length === 0) {
      var noActive = scene.add.text(leftX + 12, y, 'Keine aktiven Aufgaben', {
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#666666'
      }).setOrigin(0, 0);
      container.add(noActive);
      y += noActive.height + 8;
    } else {
      data.activeQuests.forEach(function (q) {
        var line = scene.add.text(leftX + 12, y,
          q.title + '  (' + q.progress + ')', {
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#d8d2c3',
          wordWrap: { width: innerW - 16 }
        }).setOrigin(0, 0);
        container.add(line);
        y += line.height + 3;

        // Progress bar
        var barW = innerW - 16;
        var barH = 8;
        var barBg = scene.add.graphics();
        barBg.fillStyle(0x222230, 0.8).fillRoundedRect(leftX + 12, y, barW, barH, 3);
        container.add(barBg);

        var fillW = Math.max(2, Math.floor(barW * (q.progressPct / 100)));
        var barFill = scene.add.graphics();
        barFill.fillStyle(0x4488ff, 0.9).fillRoundedRect(leftX + 12, y, fillW, barH, 3);
        container.add(barFill);
        y += barH + 6;

        // Description
        var desc = scene.add.text(leftX + 16, y, q.description, {
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#8a8a9a',
          wordWrap: { width: innerW - 24 }
        }).setOrigin(0, 0);
        container.add(desc);
        y += desc.height + 8;
      });
    }
    y += 6;

    // Completed quests with rewards
    var completedHeader = scene.add.text(leftX, y, 'Abgeschlossene Aufgaben:', {
      fontFamily: 'serif',
      fontSize: 16,
      color: '#88ff88'
    }).setOrigin(0, 0);
    container.add(completedHeader);
    y += completedHeader.height + 6;

    if (data.completedQuests.length === 0) {
      var noCompleted = scene.add.text(leftX + 12, y, 'Keine abgeschlossenen Aufgaben', {
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#666666'
      }).setOrigin(0, 0);
      container.add(noCompleted);
    } else {
      data.completedQuests.forEach(function (q) {
        var line = scene.add.text(leftX + 12, y,
          '\u2713 ' + q.title, {
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#88aa88',
          wordWrap: { width: innerW - 16 }
        }).setOrigin(0, 0);
        container.add(line);
        y += line.height + 2;

        if (q.rewards) {
          var rewardLine = scene.add.text(leftX + 24, y,
            'Belohnung: ' + q.rewards, {
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#6a8a6a',
            wordWrap: { width: innerW - 28 }
          }).setOrigin(0, 0);
          container.add(rewardLine);
          y += rewardLine.height + 4;
        }
      });
    }

    // Close hint
    var hint = scene.add.text(0, panelH / 2 - pad, 'J / ESC: schliessen', {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#888888'
    }).setOrigin(0.5, 1);
    container.add(hint);

    var closed = false;
    var close = function () {
      if (closed) return;
      closed = true;
      overlay.destroy();
      container.destroy(true);
      if (typeof onClose === 'function') onClose();
    };

    scene.input.keyboard.once('keydown-J', close);
    scene.input.keyboard.once('keydown-ESC', close);
    overlay.once('pointerdown', close);
  }

  // ---- Export ----
  var storySystem = {
    STORY_ACTS: STORY_ACTS,
    ACT_NARRATIVES: ACT_NARRATIVES,
    NPC_DIALOGUE: NPC_DIALOGUE,
    getCurrentAct: getCurrentAct,
    getCurrentActIndex: getCurrentActIndex,
    getActById: getActById,
    onWaveCompleted: onWaveCompleted,
    onEnemyKilled: onEnemyKilled,
    onRoomCleared: onRoomCleared,
    consumePendingEvent: consumePendingEvent,
    getNpcDialogue: getNpcDialogue,
    getJournalData: getJournalData,
    getStorySaveData: getStorySaveData,
    loadStorySaveData: loadStorySaveData,
    showStoryOverlay: showStoryOverlay,
    showJournalOverlay: showJournalOverlay
  };

  window.storySystem = storySystem;
})();
