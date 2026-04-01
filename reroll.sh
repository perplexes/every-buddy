#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
BINARY="$(readlink -f "$HOME/.local/bin/claude" 2>/dev/null || readlink "$HOME/.local/bin/claude")"
BACKUP="$BINARY.bak"
CONFIG="$HOME/.claude.json"
CONFIG_BACKUP="$CONFIG.bak"
ORIGINAL_SALT="friend-2026-401"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    cat << 'HELP'
Claude Code Buddy Re-roller

Usage:
  ./reroll.sh [rarity] [flags]

Rarity (default: legendary):
  common, uncommon, rare, epic, legendary

Flags:
  --shiny                  Require shiny (1% chance per roll)

  --species <name>         Require species. Options:
                             duck, goose, blob, cat, dragon, octopus, owl,
                             penguin, turtle, snail, ghost, axolotl, capybara,
                             cactus, robot, rabbit, mushroom, chonk

  --eye <glyph>            Require eye glyph. Options:
                             ·  (dot)
                             ✦  (star)
                             ×  (x)
                             ◉  (circle)
                             @  (at)
                             °  (degree)

  --hat <name>             Require hat. Options:
                             none, crown, tophat, propeller, halo,
                             wizard, beanie, tinyduck
                           Note: common rarity always gets "none"

  --min-stat <name>:<val>  Require stat >= val (repeatable). Stats:
                             debugging, patience, chaos, wisdom, snark
                           Range: 1-100. Peak stat gets +50-79 bonus.
                           Legendary floor is 50, so theoretical max
                           total is ~450 (one peak near 100, rest 50-89).

  --min-total <val>        Require sum of all stats >= val
                           Practical max ~450 for legendary.

  --max-attempts <n>       Max brute-force attempts (default 10,000,000)

  --survey <n>             Survey mode: search n million seeds and show the
                           top 20 results ranked by total stats. Applies all
                           filters. Does not patch — just prints a leaderboard.

  --salt <salt>            Skip brute-force; patch directly with this salt.
                           Use with seeds found in the buddy explorer.

  --seed <n>               Skip brute-force; find a salt that produces this
                           Mulberry32 seed, then patch.

Examples:
  ./reroll.sh legendary --shiny
  ./reroll.sh legendary --shiny --species dragon --min-stat chaos:90
  ./reroll.sh epic --min-total 400 --min-stat debugging:80 --min-stat wisdom:80
  ./reroll.sh legendary --shiny --species ghost --hat crown --eye ✦
  ./reroll.sh legendary --min-stat debugging:60 --min-stat patience:60 \
    --min-stat chaos:60 --min-stat wisdom:60 --min-stat snark:60
HELP
    exit 0
fi

echo "=== Claude Code Buddy Re-roller ==="
echo

# Ensure backups exist
[[ -f "$BACKUP" ]] || cp "$BINARY" "$BACKUP"
[[ -f "$CONFIG_BACKUP" ]] || cp "$CONFIG" "$CONFIG_BACKUP"

# Restore original binary so salt replacement works cleanly
cp "$BACKUP" "$BINARY"

# Check for --salt (direct salt) or --seed (find salt for seed)
SALT=""
prev=""
for i in "$@"; do
    if [[ "$prev" == "--salt" ]]; then SALT="$i"; break; fi
    if [[ "$prev" == "--seed" ]]; then SEED="$i"; break; fi
    prev="$i"
done

if [[ -n "${SEED:-}" ]]; then
    echo "Finding salt for seed $SEED..."
    OUTPUT=$(bun "$SCRIPT_DIR/reroll_bruteforce.js" --find-salt "$SEED")
    echo "$OUTPUT"
    SALT=$(echo "$OUTPUT" | grep "^SALT=" | cut -d= -f2)
elif [[ -z "$SALT" ]]; then
    # Brute-force — pass all args through to bun
    OUTPUT=$(bun "$SCRIPT_DIR/reroll_bruteforce.js" "$@")
    echo "$OUTPUT"
    SALT=$(echo "$OUTPUT" | grep "^SALT=" | cut -d= -f2)
fi

if [[ -z "$SALT" ]]; then
    echo "ERROR: No salt found. Restoring original binary."
    cp "$BACKUP" "$BINARY"
    exit 1
fi

# Patch binary
echo
echo "=== Patching binary with salt: $SALT ==="
perl -pi -e "s/\Q${ORIGINAL_SALT}\E/${SALT}/g" "$BINARY"
echo "  Replaced $(grep -c "$SALT" "$BINARY" || echo 0) occurrences"

# Re-sign
echo "  Re-signing binary..."
codesign --force --sign - "$BINARY"

# Strip companion from config
echo "  Stripping old companion from ~/.claude.json..."
python3 -c "
import json
with open('$CONFIG') as f:
    d = json.load(f)
d.pop('companion', None)
d.pop('companionMuted', None)
with open('$CONFIG', 'w') as f:
    json.dump(d, f, indent=2)
"

echo
echo "=== Ready! Launch 'claude' and run /buddy ==="
echo
echo "To restore:"
echo "  cp $BACKUP $BINARY && cp $CONFIG_BACKUP $CONFIG"
