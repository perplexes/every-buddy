```
   .----.        .----.       /\_/\        /^\  /^\
  / ·  · \      ( ✦  ✦ )    ( ◉   ◉)    <  @  @  >
  |      |      (      )    (  ω  )     (   ~~   )
  ~`~``~`~       `----'     (")_(")      `-vvvv-'
   ghost          blob        cat         dragon
```

# Every Buddy

**Browse, search, and install any of the 37^15 possible [Claude Code](https://docs.anthropic.com/en/docs/claude-code) companion pets.**

[**Launch the Explorer**](https://perplexes.github.io/every-buddy/)

---

## What is this?

Claude Code 2.1 introduced `/buddy` — a Tamagotchi-style companion that lives in your terminal. Each user gets a deterministic pet based on `hash(userId + salt)`. Your species, rarity, stats, eyes, hat, and shiny status are all locked in.

This project lets you **explore the entire possibility space** and **pick the buddy you actually want**.

### The Explorer

A client-side web app that computes companions in real-time using a pure JS implementation of wyhash (matching `Bun.hash` exactly). No server, no precomputation — just math.

- Scroll through salt space sequentially (like [everyuuid.com](https://everyuuid.com) but for pets)
- **Find Legendary / Epic / Rare / Shiny** search buttons
- Filter by species
- Click any buddy for full stat card
- Animated ASCII sprites from the real Claude Code source
- Copy a `./reroll.sh --salt <salt>` install command directly

### The Reroller

CLI tools that patch your local Claude Code binary to use a different salt, giving you a different companion roll.

```bash
# Find and install a shiny legendary dragon with high chaos
./reroll.sh legendary --shiny --species dragon --min-stat chaos:90

# Survey 50 million salts and show the top 20
./reroll.sh legendary --shiny --survey 50

# Install a specific salt from the explorer
./reroll.sh --salt xgew5ix6tdk4dot
```

## How it works

Claude Code generates your buddy from:

```
seed = Bun.hash(userId + salt) & 0xFFFFFFFF
```

The seed feeds a Mulberry32 PRNG that rolls your:

| Property | Options |
|----------|---------|
| **Rarity** | Common (60%), Uncommon (25%), Rare (10%), Epic (4%), Legendary (1%) |
| **Species** | duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk |
| **Eyes** | `·` `✦` `×` `◉` `@` `°` |
| **Hat** | none, crown, tophat, propeller, halo, wizard, beanie, tinyduck |
| **Shiny** | 1% chance |
| **Stats** | debugging, patience, chaos, wisdom, snark (1–100 each) |

The salt is hardcoded as `friend-2026-401` (15 bytes). The reroller binary-patches it with a different 15-byte string, re-signs the Mach-O binary, and strips your old companion soul so you get a fresh hatch.

## Quick start

### Browse online

1. Go to [**perplexes.github.io/every-buddy**](https://perplexes.github.io/every-buddy/)
2. Paste your `accountUuid` (get it with the command the page shows you)
3. Scroll, search, and find your dream buddy

### Install a buddy

```bash
git clone https://github.com/perplexes/every-buddy.git
cd every-buddy

# Requires: bun, python3, codesign (macOS)

# Let the script find the best salt for you
./reroll.sh legendary --shiny --species ghost

# Or paste a salt from the explorer
./reroll.sh --salt 000000000000abc
```

### Restore your original buddy

```bash
cp ~/.local/share/claude/versions/*.bak ~/.local/share/claude/versions/$(basename $(readlink ~/.local/bin/claude))
cp ~/.claude.json.bak ~/.claude.json
```

## Reroller flags

```
./reroll.sh --help
```

| Flag | Description |
|------|-------------|
| `--shiny` | Require shiny (1% chance per roll) |
| `--species <name>` | Require specific species |
| `--eye <glyph>` | Require specific eye glyph |
| `--hat <name>` | Require specific hat |
| `--min-stat <name>:<val>` | Require stat >= value (repeatable) |
| `--min-total <val>` | Require sum of all stats >= value |
| `--survey <n>` | Search n million salts, show top 20 |
| `--salt <salt>` | Skip search, patch with this salt directly |
| `--max-attempts <n>` | Max brute-force attempts (default 10M) |

## How the explorer works

The wyhash implementation is pure JavaScript using BigInt for 64-bit arithmetic. It matches `Bun.hash()` exactly — verified against 9 test vectors including the actual buddy salts. This means what you see in the browser is exactly what you'll get when you install the salt.

Salt space is treated as a base-37 number (`0-9a-z-`), giving 37^15 ≈ 1.5 × 10^23 possible salts. The explorer walks through them sequentially, computing `wyhash(userId + salt)` → Mulberry32 → buddy roll entirely client-side.

## Disclaimer

This patches your Claude Code binary. It will be overwritten on auto-update. Use at your own risk. Anthropic probably thinks this is funny. Probably.

## License

MIT
