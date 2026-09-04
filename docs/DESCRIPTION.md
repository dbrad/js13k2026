---
Purpose: A markdown file to capture the game's description to be published during game submission.
---

# Prism Break

*js13k 2026 entry by david brad — theme: "Unicorns and Rainbows"*

## Tagline

No sparkles. No candy floss. Just you, your horn, and a dungeon full of things that want to eat the light out of you.

## Short description

**Prism Break** is a 13KB dark-dungeon first-person shooter — Wolfenstein 3D energy in a js13k body. You're a unicorn who woke up in a void-soaked crypt with no memory of how you got here. Your horn still works. That's the problem: it fires a rainbow laser, and every monster in these walls knows it.

Charge your beam, punch through cracked walls, hunt down three procedurally generated floors, and kill the boss at the bottom of each one. Every boss you put down strengthens your connection to the light — wider, harder-hitting, longer-reaching beams. Survive floor three. Get out.

## The story (the honest version)

Something dragged a unicorn into the dark and locked the door. There's no lore dump. No cutscene. The game just starts, and the toast says everything you need to know:

> *escape this place*

The dungeon is pitch black except for your torch and whatever glow the void things are leaking. Every closed door needs a hand on it (press `E` in front of one). Cracked walls hide caches. At the end of every floor sits a boss room behind a sealed exit — and that seal only breaks when everything left in that room is dead.

## Gameplay

- **3 floors, zero repeats.** Every run is a fresh procedurally generated dungeon — rooms, doors, enemy placement, secrets, even which boss you get, are all rolled from your run seed. No two crypts match.
- **Charge-shot combat.** Hold fire to charge the rainbow beam, release to fire. A full charge hits harder, flies farther, and spreads wider than a tap shot — but you sit in a cooldown before the next one. Poking is free but weak; committing your charge is how things actually die.
- **Three bosses, shuffled per run.** You never know which one's waiting on the other side of the door:
  - one that answers your damage with faster and faster radial bullet-hell rings,
  - a broodmother who keeps her distance and feeds the room to you in fresh minions,
  - a charger who orbits, locks on, then rams you at speed.
- **It scales.** Enemy health ramps up floor by floor, so wandering around the map looking pretty gets old fast. Only the boss room locks the exit — side rooms are technically optional. That's a choice about how much health you want walking in, and the dungeon will make it.
- **The environment is fair, but it's not safe.** Cracked walls take one shot and open into hidden rooms with pickups. Health packs are your only repair, and you have ten hit points. You will know when a melee hit cost something.
- **Your tools:** a minimap (M) for route planning and room tracking, door prompts when you're in range, and menu options for aim assist, headbob, screen shake, music, and WASD/ZQSD keymap if your hands want it different.

## Controls (desktop)

| Action | Keys |
|---|---|
| Move | `W A S D` or `Z Q S D` (menu toggle) |
| Look | Mouse (click the game, or press `F`, to lock the pointer) — arrow keys also strafe/turn |
| Fire / charge rainbow beam | Hold left mouse button or `Space`, release to fire |
| Open doors | `E` or `Enter` when standing in front of one |
| Minimap | `M` |

Everything else — music, headbob, screen shake, aim assist, keymap layout — is a toggle on the main menu, and it sticks between sessions.

## The loop

Wander in from the dark → open doors (`E`), clear rooms → crack open secrets for health → boss down, gain a charge tier, exit seal breaks → step through to the next floor. Do that three times and you're out.

Die and it's back to the main menu with your settings intact — run it again, because you didn't see *this* layout coming.

## What to know before you dive in

- **Desktop game.** Mouse + keyboard required; there's no touch scheme.
- **It's short on purpose.** Three floors per run is a few minutes of real attention, not three hours. It's built for another run right after you die.
- **Aim assist is on by default** and it actually works — the beam drifts gently toward what you're pointing at. Turn it off in the menu if you want pure mouse discipline.
- **The first boss is a warmup.** The dungeon gets mean fast. Stock up, read the room layout on the minimap, and don't hold your charge on empty air.

## In one line

A 13KB unicorn FPS where the rainbow is the gun, the darkness is the atmosphere, and "cute theme" was a setup for the worst thing in the dungeon.
