# Overview

Demonfall Prototype is a browser-based 2D action game built with Phaser.js. The game features a dungeon crawler with procedural room generation, combat mechanics, inventory management, and a hub world. Players fight through waves of enemies in different rooms, collect loot, and upgrade their equipment. The game includes a Firebase-powered leaderboard system, a skill progression system with Eisenbrocken (iron chunks) currency, and supports both desktop and mobile controls.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Game Engine**: Phaser.js 3.70.0 for 2D game rendering and physics
- **Scene Management**: Multi-scene architecture with StartScene (menu), HubScene (town/workshop), and GameScene (dungeon combat)
- **Rendering**: Pixel-art optimized with anti-aliasing disabled and pixel-perfect rendering
- **Input System**: Dual input support for desktop (keyboard) and mobile (virtual joystick via rex-virtualjoystick plugin)
- **UI Framework**: Native Phaser UI elements with custom inventory and HUD systems

## Game Systems
- **Room Generation**: Template-based procedural room system using JSON templates stored in `/js/roomTemplates/`
- **Combat System**: Real-time arcade-style combat with player attacks, enemy AI, and projectile systems
- **Wave System**: Progressive difficulty with boss encounters every 5th wave
- **Inventory & Equipment**: Grid-based inventory with weapon/armor equipment slots
- **Skill System**: Three-branch skill tree (Kampf/Combat, Überleben/Survival, Mobilität/Mobility) with Eisenbrocken currency, accessed via Mara NPC in hub
- **Save/Load**: LocalStorage-based game state persistence with skill progression
- **Loading Screen**: Visual progress bar with percentage and asset name display during initial asset loading

## Physics & Movement
- **Physics Engine**: Phaser Arcade Physics for collision detection and movement
- **AI System**: Steering behaviors for enemy movement (separation, cohesion, obstacle avoidance)
- **Collision System**: Static obstacle groups with physics-based collision detection

## Asset Management
- **Texture Generation**: Procedural texture creation using Phaser Graphics API
- **Dynamic Loading**: Runtime texture generation for buildings, obstacles, and UI elements
- **Template System**: JSON-based room templates with manifest-driven loading

## Data Storage
- **Local Persistence**: Browser localStorage for game saves and progress
- **Room Templates**: Static JSON files defining dungeon layouts, enemy spawns, and loot placement
- **Configuration**: JavaScript-based configuration files for game balance and settings

# External Dependencies

## Core Libraries
- **Phaser.js 3.70.0**: Main game engine via CDN
- **rex-virtualjoystick**: Mobile touch controls plugin via CDN

## Cloud Services
- **Firebase Firestore**: Real-time leaderboard system
  - Project: demonfall-leaderboard
  - Collections: leaderboard (stores player scores with name, score, timestamp)
  - Operations: Read top 10 scores, write new scores

## Development Tools
- **serve**: Local development server for static file serving
- **Node.js**: Build scripts for template manifest generation

## Browser APIs
- **localStorage**: Game state persistence
- **Canvas API**: 2D rendering (via Phaser)
- **Touch/Mouse Events**: Input handling across devices
- **Fullscreen API**: Optional fullscreen mode support

## Asset Dependencies
- **Font Rendering**: System fonts (serif family) with high-resolution text rendering
- **Image Processing**: Runtime texture generation, no external image assets required
- **Audio**: Framework present but no current audio implementation