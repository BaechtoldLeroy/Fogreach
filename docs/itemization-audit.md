# Itemization-Audit (Stand 2026-06-23)

Bestandsaufnahme aller Stat-/Affix-Systeme für Items. Ziel: den „Wildwuchs"
sichtbar machen, **bevor** wir refactoren — damit nichts übersehen wird.

Alle Zeilenangaben gegen den aktuellen Code geprüft (`js/lootSystem.js`,
`js/loot.js`, `js/inventory.js`, `js/player.js`, `js/main.js`).

---

## 1. TL;DR

Ein einzelnes gedropptes Item trägt **bis zu vier voneinander unabhängige
Stat-Schichten**, die aus **zwei parallelen Erzeugungs-Pipelines** stammen und
an **drei verschiedenen Stellen** konsumiert werden. Davon ist ein knappes
Drittel der Affixe **tot** (wird angezeigt, wirkt aber nicht), und die
Bewegungsgeschwindigkeit-aus-Ausrüstung ist zwar komplett verdrahtet, wird
aber von **keinem** Item je befüllt.

Funktioniert das Spiel? Ja — Item-*Power* kommt an. Aber das System ist
mitten in einer nie abgeschlossenen Migration (Code-Kommentar `loot.js:37`:
„*while we finish migrating callers onto LootSystem.rollItem*").

---

## 2. Die vier Stat-Schichten pro Item

| # | Schicht | Form am Item | Quelle | Wirkt? |
|---|---------|--------------|--------|--------|
| 1 | **Flache Core-Stats** | `it.damage/speed/range/hp/armor/crit/move` (top-level) | beide Pipelines | ✅ ja — `recalcDerived` summiert |
| 2 | **AFFIX_DEFS-Affixe** | `it.affixes[] = [{defId, value}]` | `LootSystem.rollAffixes` | teils — siehe §4 |
| 3 | **ATTACK_EFFECTS** | `it.attackEffects[] = [{id, ability, stat, value}]` | `loot.js maybeAttachAttackEffect` | ✅ ja — `recalcDerived` → `applyAbilityEffect` |
| 4 | **baseStats-Subobjekt** | `it.baseStats = {damage,…}` | beide Pipelines | ⚠️ nur Spiegel/Anzeige — nicht separat konsumiert |

Schicht 4 ist eine **Kopie** von Schicht 1 (in `rollItem` zu den flachen
Feldern gespiegelt, `lootSystem.js:543-550`; in `randomLoot` parallel gesetzt,
`loot.js:687-700`). Sie dient Tooltips/Migration, nicht der Stat-Berechnung.

---

## 3. Wo ist was definiert (Datei-Landkarte)

### `js/lootSystem.js` — das „neue" System (Feature 020)
- **`AFFIX_DEFS`** (Z. 175-259) — 24 eingefrorene Affixe, *single source of truth*. Shape: `{id, displayName, position, statKey, valueType, range, iLevelMin, weight, appliesTo[], tooltipText}`.
- **`ITEM_BASES`** (Z. 265-307) — 13 Basis-Templates mit `baseStats` (damage/speed/crit/armor/range).
- **`rollAffixes`** (Z. 341) — gewichtete Affix-Auswahl ohne Zurücklegen.
- **`rollItem`** (Z. 497) — Item aus ITEM_BASES + Affixe; spiegelt baseStats → flache Felder.
- **`recomputeBonuses` / `getBonus`** (Z. 386 / 420) — Affix-Cache (`_bonusCache.flat/.percent`), O(1)-Lookup.

### `js/loot.js` — das „legacy" System (parallel weiter aktiv)
- **`ITEM_STAT_KEYS`** = `['hp','damage','speed','range','armor','crit']`, **`ITEM_ALL_STAT_KEYS`** = `[…, 'move']` (Z. 49-50).
- **`ITEM_SLOT_MODS`** (Z. 52-58) — eigene per-Slot-Multiplikatoren (zweites Balancing-Schema neben ITEM_BASES).
- **`ATTACK_EFFECT_OPTIONS`** (Z. 61-74) — **zweites** per-Ability-System (damage/cooldown für attack/spin/charge/dash/dagger/shield).
- **`rollItemStatPotentials`** (Z. 533) / **`applyTierBoosts`** (Z. 610) — erzeugen die flachen Core-Stats.
- **`randomLoot`** (Z. 659) — der eigentliche Drop-Generator; baut Schicht 1 + 2 + 3 zusammen.
- **`maybeAttachAttackEffect`** (Z. 120) — hängt ATTACK_EFFECTS an und **nullt dabei einen zufälligen flachen Stat** (Z. 128-131).

### Konsum-Stellen
- **`inventory.js recalcDerived`** (Z. 852-879) — summiert Schicht 1 → `weaponDamage/weaponAttackSpeed/attackRange/playerSpeed/playerArmor/playerCritChance/maxHP`. Wendet `getBonus('hp')` (Z. 896) und alle `attackEffects` (Z. 933-940) an.
- **`player.js`** — `getBonus('lifesteal')` (Z. 664), `getLootAbilityDamageBonus` (Z. 881), `getLootAbilityCooldownReduction` (Z. 890).
- **`main.js`** (Z. 2287-2290) — per-Ability dmg/cd für HUD-Badges.

---

## 4. Affix-Status: was wirkt, was ist tot

`getBonus` wird für genau **14** statKeys konsumiert. AFFIX_DEFS definiert
**24**. Damit sind **10 Affixe tot** (Name + Tooltip erscheinen, Effekt = 0):

| statKey | Affix | Status |
|---------|-------|--------|
| `hp` | of the Bear | ✅ → maxHealth (`inventory.js:896`) |
| `lifesteal` | of the Leech | ✅ → `player.js:664` |
| `dmg_spinAttack/chargeSlash/dashSlash/daggerThrow/shieldBash` | Spinning/Charged/Dashing/Piercing/Bashing | ✅ → `player.js:883` |
| `dmg_all_abilities` | of Might | ✅ |
| `cd_spinAttack/…/shieldBash` (5) | of Swift … | ✅ → `player.js:892` |
| `cd_all_abilities` | of Haste | ✅ |
| **`damage`** | **Sharp** | ❌ **tot** (kein Consumer für % damage) |
| **`armor`** | **Sturdy** | ❌ **tot** |
| **`speed`** | **Swift** | ❌ **tot** |
| **`crit`** | **of Precision** | ❌ **tot** |
| **`range`** | **of Reach** | ❌ **tot** |
| **`resist_fire/cold/lightning`** | Fireproof/Frostproof/Stormproof | ❌ **tot** (keine Schadens-Mitigation existiert) |
| **`xp_gain`** | **of Wisdom** | ❌ **tot** |
| **`gold_find`** | **of Greed** | ❌ **tot** (Gold skaliert über KnowledgeTree/Printing, nicht Affix) |

**Wichtig:** Die toten *Basis*-Stat-Affixe (damage/armor/speed/crit/range)
betreffen Stats, die es im Spiel sehr wohl gibt — aber über **Schicht 1**
(flache Core-Stats), nicht über den Affix. D. h. eine „Scharfe Eisenklinge"
zeigt im Tooltip „+20 % Schaden", addiert real aber **0 %**; nur der flache
Basis-Schaden (8) zählt. Das ist die irreführendste Stelle: **Tooltips
versprechen Werte, die nie ankommen.**

Resists (`resist_*`) haben **keinen** Flat-Layer-Ersatz — es gibt überhaupt
keine Element-Mitigation. Tot ohne Auffangnetz.

---

## 5. Die zwei Pipelines (warum es doppelt ist)

```
Drop eines Gegners
  └─ spawnLoot()  [loot.js:213]
       └─ randomLoot()  [loot.js:659]   ← LEGACY-Pfad, ~Standard
            ├─ rollItemStatPotentials + applyTierBoosts → Schicht 1 (flach)
            ├─ LootSystem.rollAffixes (nur tier>0)       → Schicht 2 (Affixe)
            └─ maybeAttachAttackEffect                   → Schicht 3 (ATTACK_EFFECTS)
       └─ Ausnahme: 25 % der Waffen-Drops sind Bögen →
            LootSystem.rollItem(...)  [lootSystem.js:497] ← NEUER Pfad

Shop / Mara
  └─ _generateShopStock → LootSystem.rollItem()           ← NEUER Pfad (nur Schicht 1+2)

Tutorial-Waffe, Reroll
  └─ LootSystem.rollItem / rollAffixes                     ← NEUER Pfad
```

Folge: **Gegner-Drops** (legacy) tragen alle drei Schichten und können
gleichzeitig ein per-Ability-Bonus aus **Schicht 2** (`dmg_spinAttack`) *und*
aus **Schicht 3** (`spin_damage`) haben — zwei Mechaniken für dasselbe.
**Shop-Items** (neu) tragen nur Schicht 1+2, nie ATTACK_EFFECTS. Zwei
Item-Quellen mit unterschiedlichem Stat-Profil.

---

## 6. Der „Wildwuchs" — konkrete Befunde

1. **Per-Ability-Schaden/Cooldown existiert doppelt** — AFFIX_DEFS (`dmg_*`,
   `cd_*`, 10 Affixe) **und** ATTACK_EFFECTS (`*_damage`, `*_cooldown`,
   12 Optionen). Überlappend, unterschiedlich balanciert, andere Ability-Namen
   (`spinAttack` vs `spin`).
2. **10 von 24 AFFIX_DEFS sind tot** (§4) — inkl. der „offensichtlichsten"
   Affixe (Sharp/Sturdy/Swift). Tooltips lügen.
3. **Bewegungstempo aus Gear existiert nicht real.** `recalcDerived` summiert
   `sum.move → playerSpeed` (Pipeline vollständig), aber **kein ITEM_BASES und
   kein `rollItemStatPotentials` setzt je `move`**. → genau die Lücke hinter
   deiner „move-Affix"-Vermutung.
4. **`speed` ist falsch gemappt.** ITEM_BASES-Stiefel (`Lederstiefel speed:15`)
   und legacy-Stiefel mappen `speed → weaponAttackSpeed` (Angriffstempo),
   nicht Lauftempo. „Flinke/Swift"-Items beschleunigen also Angriffe, nicht
   Bewegung — entgegen Name/Tooltip.
5. **Zwei Balancing-Schemata** für flache Stats: `ITEM_BASES.baseStats`
   (neu, fixe Werte) vs `ITEM_SLOT_MODS × rollItemStatPotentials` (legacy,
   tiefenskaliert). Ein Item-Typ wird je nach Pipeline anders gewichtet.
6. **`maybeAttachAttackEffect` nullt einen flachen Stat** (`loot.js:128-131`),
   wenn es ein Attack-Effect anhängt — versteckte Kopplung zwischen Schicht 1
   und 3.
7. **`resist_*` ohne Konsument** — Element-Resistenz als Konzept nirgends
   implementiert.
8. **Schicht 4 (`baseStats`-Subobjekt)** dupliziert Schicht 1 — zwei Quellen
   für „den Basis-Schaden", Risiko für Drift.

---

## 7. Vorgeschlagene Zielarchitektur

**Leitidee:** AFFIX_DEFS wird das **einzige** Affix-System; loot.js wird auf
einen reinen Roll-Wrapper um `LootSystem.rollItem` reduziert; tote Affixe
werden entweder **scharf geschaltet** oder **entfernt** — keine toten
Tooltips.

### Schritt-Plan (inkrementell, je testbar)
1. **Pipelines vereinheitlichen** — alle Drops über `LootSystem.rollItem`;
   `randomLoot` nur noch Auswahl/Tiefe → delegiert. Entfernt Schicht-Divergenz
   zwischen Drop und Shop.
2. **Per-Ability konsolidieren** — ATTACK_EFFECTS (Schicht 3) streichen,
   Funktionalität lebt in AFFIX_DEFS `dmg_*`/`cd_*` weiter. Ein System.
3. **Tote Basis-Affixe scharf schalten** — in `recalcDerived` die
   percent-Boni aus `getBonus('damage'/'armor'/'speed'/'crit'/'range')`
   anwenden (multiplikativ auf die jeweilige abgeleitete Größe). Damit wirken
   Sharp/Sturdy/Swift/Precision/Reach wie ihre Tooltips versprechen.
4. **Move-Stat reparieren** — entweder echtes Lauftempo-Affix einführen
   (`statKey:'move'`) **oder** „Swift/speed" sauber als Angriffstempo
   umbenennen. Entscheidung nötig: soll Gear Lauftempo geben?
5. **Resists** — entweder Element-Mitigation in der Schadensberechnung
   einführen (dann `resist_*` wired) oder die 3 Affixe entfernen.
6. **gold_find / xp_gain** — an den Award-Stellen (`grantGold`, XP-Vergabe)
   `getBonus` einhängen oder Affixe entfernen.
7. **Schicht 4 entkoppeln** — `baseStats` nur als Anzeige-Snapshot behalten,
   eindeutig dokumentieren, dass die flachen Felder die Wahrheit sind.

### Beschlüsse (2026-06-23, gelockt)
- **A — Lauftempo:** ✅ **Neues `move`-Affix** (statKey `move`, percent oder
  flat → `playerSpeed`). `swift_speed` („Flinke/Swift") bleibt das
  **Angriffstempo**-Affix (statKey `speed` → `weaponAttackSpeed`) und wird in
  Name/Tooltip sauber als Angriffstempo geführt. Kein neues Attack-Speed-Affix
  — das bestehende `swift_speed` ist es bereits.
- **B — Resists:** ✅ **Entfernen.** `fire_warding`, `cold_warding`,
  `lightning_warding` raus aus AFFIX_DEFS (+ i18n-Strings + Tests).
- **C — Tote Basis-Affixe:** ✅ **Alle 5 scharf schalten**, integriert in die
  **bestehenden** Mechaniken (kein Parallelsystem):
  | Affix | statKey | Anwendung in `recalcDerived` |
  |---|---|---|
  | Scharfe | `damage` (%) | `weaponDamage *= (1 + getBonus('damage'))` |
  | Robuste | `armor` (flat) | `playerArmor += getBonus('armor')/100` (Einheiten-Fix!) |
  | Flinke | `speed` (%) | `weaponAttackSpeed *= (1 + getBonus('speed'))` (= Angriffstempo) |
  | der Präzision | `crit` (%) | `playerCritChance += getBonus('crit')/100` |
  | der Reichweite | `range` (flat) | `attackRange += getBonus('range')` |

### Umsetzungs-Phasen
- **Phase 1 (entschieden, klar abgegrenzt):** A + B + C oben. Plus `gold_find`/
  `xp_gain` an `grantGold` / XP-Vergabe einhängen (Schritt 6). Reine Wiring-
  Arbeit in `recalcDerived` + Award-Stellen, AFFIX_DEFS bereinigen.
- **Phase 2 (struktureller Umbau, separat):** Schritt 1 (Pipelines
  vereinheitlichen) + Schritt 2 (ATTACK_EFFECTS vs AFFIX_DEFS per-Ability
  entdoppeln). Größer/riskanter — bewusst nach Phase 1.

Beide Phasen als eigene spec-kitty-Features schneidbar.
