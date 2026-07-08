# Research: DefendMode Gegner-Targeting (Feature 061, WP03, R1)

## Frage
Können Gegner ein NICHT-Spieler-Ziel (das Verteidigungs-Objekt) ansteuern und angreifen?

## Befund (js/enemy.js)
Die Gegner-KI referenziert **überall hart `player.x` / `player.y`** (seek/arrive/melee/ranged
in ~15 Stellen, u. a. Zeilen 851, 890, 909–910, 959–965, 985–990). Es gibt **keinen**
zentralen Ziel-Vektor, den man umbiegen könnte. Ein Umlenken auf ein Objekt hieße, alle
diese Stellen zu ändern (oder einen globalen Ziel-Override einzuziehen) → **invasiv und
riskant** für ein Feature, das primär Raum-Varianz bringt.

## Entscheidung: Präsenz-Drain statt KI-Umbau
DefendMode nutzt die BESTEHENDE KI unverändert (Gegner jagen weiter den Spieler). Das zu
schützende Objekt ist ein **Kern/Altar**, der durch die bloße **Präsenz lebender Gegner**
im Raum korrumpiert wird:

```
objHp -= (aliveEnemyCount * DRAIN_PER_ENEMY_PER_SEC) * dt
```

- **Verteidigen** = die Welle **schnell räumen**, bevor der Kern auf 0 fällt.
- **Erfolg** (`isComplete`) = Welle geräumt (über den WP01-Hook `onWaveCleared`).
- **Verfehlt** (`objectiveFailed`) = Kern-HP ≤ 0 → kein Bonus-Chest, Raum bleibt aber offen (#1).

**Vorteile:** kein KI-Risiko, verlustfrei zum restlichen Kampf, thematisch stimmig
(„die Dämonen-Präsenz verdirbt den Altar — räum sie, bevor er fällt"). Ein echtes
KI-Targeting bleibt als späteres Upgrade möglich, ist aber nicht nötig.
