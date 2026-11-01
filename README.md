# WACKY RACING: ULTIMATE KART CHAOS 🏁 (no emoji — just pretend Flag)

A complete, original, fully playable 3D cartoon kart-racing game that runs **in the browser** on
desktop, iOS, and Android — with real peer-to-peer multiplayer, 10 ridiculous vehicles,
8 crazy tracks, 10 chaotic power-ups, a full progression economy, and a live leaderboard backend.

Everything (models, sounds, music, characters, tracks) is **procedurally generated at runtime** —
zero copyrighted assets, zero downloaded media files.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

Database (PostgreSQL + Drizzle ORM):

```bash
# create DATABASE_URL in .env, then:
npx drizzle-kit push
```

The game itself needs **no build step beyond Next.js** — the 3D engine, sounds and music are
all generated in the browser.

---

## How to play

### PC controls
| Key | Action |
| --- | --- |
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer |
| `SPACE` (hold) | Drift — release for a mini-turbo (gold sparks = BIG boost) |
| `E` / `ENTER` | Use power-up |
| `H` | Honk your horn (unlockable horn sounds!) |
| `ESC` | Pause |

### Mobile / tablet
Touch controls appear automatically on touch devices: steering buttons on one side,
**GAS / STOP / DRIFT** on the other, and a chunky item button when you grab a `?` box.

### Settings → Controls
- **Key remapping** — click any binding chip and press a new key (Esc pauses, arrows always stay as a second set)
- **Steering response** slider (mellow ↔ twitchy)
- **Touch button size** slider (80–150%)
- **Swap sides** — put the pedals on the left for left-handed racers
- **Tilt steering** — gyro steering on phones (requests motion permission on iOS); the steering buttons hide and you steer by rolling the device

---

## Game modes

| Mode | What it is |
| --- | --- |
| **Quick Race** | 3 laps vs 5 CPU rivals |
| **Grand Prix** | 3-race cup with championship points |
| **Elimination** | Last place gets *yeeted* every lap |
| **Team Racing** | 3v3 squad points battle |
| **Chaos Mode** | Double items + random events every 15 s (bounce fest, tiny mode, moon gravity…) |
| **Time Trial** | 5 flying laps against the leaderboard |
| **Practice** | Free-roam any track |
| **Friends Room** | **Real online P2P multiplayer** via WebRTC room codes (host also simulates clearly-labeled CPU rivals) |

### Friends Room (multiplayer)

1. Host: open **Friends Room → Host a room → Create Room**.
2. Copy the generated **INVITE code**, send it to your friend (any messenger).
3. Friend: **Join a room**, paste the invite, copy the **ANSWER code** they get, send it back.
4. Host pastes the answer → connected. Repeat for more friends.
5. Host picks a track and hits **START RACE**. Race state (positions, hazards, items,
   finishes) syncs peer-to-peer; the host's browser is authoritative for bots and results.

> P2P uses WebRTC data channels with public STUN. Some restrictive networks block P2P —
> the game tells you when a connection fails, and single-player always works.

## Car collection (20 vehicles, 4 rarity tiers)

Every car has its own acceleration / top speed / handling / drift / weight stats **and a unique
passive ability** that changes how you drive it.

| Rarity | Cars |
| --- | --- |
| **Common** | Shopping Cart, Chicken Bike, Pizza Scooter, Skateboard Supreme, Lawn Mower Menace |
| **Rare** | Bathtub Racer, Rocket Scooter, Toaster Turbo, Banana Mobile, Coffee Cup Cruiser, Rubber Duck Car, Ice Cream Truck, Monster Truck |
| **Epic** | Flying Carpet, Mini Tank, Hot Air Kart, Submarine Racer |
| **Legendary** | Dino Stomper, UFO Saucer, Golden Chariot |

Example abilities: *Kickflip* (ramps give instant trick boosts), *Grass Clippings* (off-track
barely slows you), *Pop-Up Launch* (toast-powered hop from a standstill), *Caffeine Rush* (every
coin is a mini-boost), *Brain Freeze* (bumping you chills the attacker), *Prehistoric Stomp*
(landing shockwaves rivals away), *Tractor Beam* (magnetises coins and item boxes),
*Champion's Aura* (+15% coins from every race).

### Collection screen
- **Car photos** — every card shows a real rendered image of the car, snapshotted from its own
  3D model by a single shared offscreen renderer and cached (`src/game/thumbs.ts`), so the
  pictures always match the in-game car and nothing is downloaded.
- **Fast selection** — search box, filters (all / favorites / owned / locked / each rarity),
  sorting (rarity, price, rating, name), ⭐ favorites, and a one-tap **Equip** button on every card.
- **Equipped strip** at the top with a photo of your current ride and a **Race now** button.
- **Quick-pick bar** on the track-select screen so you can swap cars right before a race
  (favorites float to the front) without leaving the flow.
- **Test drive** any owned car instantly in Practice mode.

## Upgrade / tuning system

Each car can be individually tuned with four upgrade lines, 5 levels each (20 levels per car):

| Upgrade | Effect |
| --- | --- |
| **Engine** | +Top speed, +Acceleration |
| **Tires** | +Handling, +Drift |
| **Turbo** | +Acceleration, +Drift |
| **Frame** | −Weight, +Handling |

- Upgrades are **bought with earned coins only** — no real money, and they're applied per-car so
  your tuning is part of the collection chase.
- Costs scale with level **and rarity** (a legendary costs 2.4× a common to max out).
- The Tune tab shows level pips, live cost, and stat bars that display the **base stat plus a gold
  upgrade bonus segment**.
- Upgraded stats feed straight into the real physics (max speed, acceleration, turn rate, mass,
  drift charge rate), so a maxed car genuinely drives better.
- Fully server-validated: level caps, costs, ownership checks and coin deduction all happen in
  `/api/shop/upgrade` — clients can't send their own level or price.
- New achievements: **Collector** (10 cars), **Completionist** (all 20), **Master Tuner** (20 upgrade levels).

## Economy & purchase system

Two earned currencies — **coins** (every race) and **gems** (podium finishes: 3/2/1 for P1/P2/P3).
There is **no real-money store**; gems can also be exchanged from coins.

- **Direct purchase** — buy any car with coins, or epics/legendaries with gems.
- **Mystery crates** — Rusty (coins), Turbo (coins), Legend (gems). Rolls happen **on the server**
  with published odds, and **duplicate protection** guarantees a car you don't own yet; once a tier
  is complete you get cosmetics or a coin payout instead.
- **Bundles** — curated multi-car packs (Chaos Starter, Heavy Metal Garage, Sky High, Legend Vault)
  with automatic discount badges vs. buying separately.
- **Cosmetics** — hats, wheels, horns and victory dances.
- **Gem exchange** — trade coins for gems at three rates.

All prices, crate rolls and wallet math are validated server-side against the shared catalog —
the client can't spoof a price, re-buy an owned item, or roll its own loot.

## The 8 tracks

Candy Rush · Toilet Town · Banana Jungle · Toy Factory · Sky Highway · Volcano Speedway ·
Penguin Ice Road (very slippery!) · Alien Crazy Circuit — all with ramps, item rows, coins,
moving obstacles, themed scenery and melodies of chaos.

## The 10 power-ups

Rocket Boost · Banana Trap · Mega Punch · Coin Magnet · Bubble Shield · Freeze Bomb ·
Giant Mode · Turbo Chicken (homing poultry missile) · Reverse Controls · Teleport Surprise.
Item rolls are position-balanced: the leader gets bananas, last place gets rockets.

## Progression & economy

- Sign in with just a racer name (no password) — progress is stored server-side (PostgreSQL).
- Earn coins & XP every race (server computes rewards; clients never submit currency).
- Daily challenges, achievements, seasonal event banner.
- Spend coins on **cosmetic-only** unlocks: vehicles, characters, hats, wheels, horns, dances.
- Global leaderboards: best lap per track + top racers by XP, server-verified (lap-time floor).
- Level progression from XP (`level = √(xp/60) + 1`).

## Project structure

```
src/
  app/
    page.tsx               # App shell: menu ↔ race ↔ results flow
    layout.tsx             # Fonts / metadata
    globals.css            # Chunky cartoon UI system
    api/
      profile/route.ts     # Create/load racer profiles
      sync/route.ts        # Purchases, dailies, stats (server-validated)
      race/result/route.ts # Server-computed XP/coin rewards + best laps
      leaderboard/route.ts # Track leaderboards + top racers
      health/route.ts      # Health check
  db/
    schema.ts              # players, race_results, best_laps
    index.ts               # Drizzle client
  game/
    data.ts                # Vehicles, tracks, characters, power-ups, modes, dailies
    builders.ts            # Procedural 3D: karts, characters, track geometry, decor, hazards
    engine.ts              # The game: physics, bots, items, modes, particles, chase cam, net sync
    audio.ts               # 100% procedural WebAudio SFX + music sequencer
    net.ts                 # WebRTC P2P rooms (manual-signaling invite codes)
  lib/
    store.ts               # Zustand app state, profile sync, HUD store
  components/
    menus.tsx              # All menu screens + results + friends room UI
    game.tsx               # Race screen: HUD, speedometer, minimap, touch controls
    preview3d.tsx          # Turntable 3D previews for garage/characters
```

## Tech notes

- **Rendering:** Three.js, flat-shaded cartoon primitives, fog, hemisphere + shadowed sun,
  pooled particle system (zero per-frame allocation).
- **Physics:** custom arcade kart model — speed scalar + lateral slide, drift charge →
  mini-turbo, squash-landings, airborne backflips, kart-vs-kart mass collisions, track
  containment via closest-spline-point walls.
- **Bots:** spline-following AI with corner braking, drifting, item use, hazard avoidance
  and gentle rubber-banding. Always clearly labeled `(CPU)` — they're for offline play only,
  never a substitute for real opponents in Friends Rooms.
- **Anti-cheat:** the backend computes all XP/coin awards itself, validates timestamps and
  lap-time floors, clamps stat deltas, and authenticates writes with per-player tokens.
- **Audio:** everything is synthesized (engine RPM oscillator, drumless chiptune sequencer,
  chicken clucks, boings, splats, fanfares).

## Deployment

Any Node host running Next.js works (Vercel, Railway, a VM…). Required env:

```
DATABASE_URL=postgres://user:pass@host:5432/dbname
```

Run `npx drizzle-kit push` once against the database, then `npm run build && npm start`.

---

*Made entirely from code. No chickens were consulted (they would have demanded steering rights).*
