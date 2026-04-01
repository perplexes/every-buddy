// Brute-force a buddy salt with filters using actual Bun.hash
//
// Usage:
//   bun reroll_bruteforce.js [rarity] [flags]
//
// Rarity (default: legendary):
//   common | uncommon | rare | epic | legendary
//
// Flags:
//   --shiny                  Require shiny (1% chance per roll)
//   --species <name>         Require species:
//                              duck, goose, blob, cat, dragon, octopus, owl,
//                              penguin, turtle, snail, ghost, axolotl, capybara,
//                              cactus, robot, rabbit, mushroom, chonk
//   --eye <glyph>            Require eye: · ✦ × ◉ @ °
//   --hat <name>             Require hat:
//                              none, crown, tophat, propeller, halo,
//                              wizard, beanie, tinyduck
//                            (common rarity always gets "none")
//   --min-stat <name>:<val>  Require stat >= val (repeatable):
//                              debugging, patience, chaos, wisdom, snark
//                            Range 1-100. Peak stat gets +50-79 bonus.
//   --min-total <val>        Require sum of all stats >= val (max ~450 legendary)
//   --max-attempts <n>       Max attempts (default 10,000,000)
//
// Examples:
//   bun reroll_bruteforce.js legendary --shiny
//   bun reroll_bruteforce.js legendary --shiny --species dragon --min-stat debugging:90
//   bun reroll_bruteforce.js epic --min-total 400 --species ghost
//   bun reroll_bruteforce.js legendary --hat crown --eye ✦ --min-stat chaos:80

if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log(`Claude Code Buddy Re-roller (brute-force engine)

Usage:
  bun reroll_bruteforce.js [rarity] [flags]

Rarity (default: legendary):
  common | uncommon | rare | epic | legendary

Flags:
  --shiny                  Require shiny (1% chance per roll)
  --species <name>         Require species:
                             duck, goose, blob, cat, dragon, octopus, owl,
                             penguin, turtle, snail, ghost, axolotl, capybara,
                             cactus, robot, rabbit, mushroom, chonk
  --eye <glyph>            Require eye: · ✦ × ◉ @ °
  --hat <name>             Require hat:
                             none, crown, tophat, propeller, halo,
                             wizard, beanie, tinyduck
                           (common rarity always gets "none")
  --min-stat <name>:<val>  Require stat >= val (repeatable):
                             debugging, patience, chaos, wisdom, snark
                           Range 1-100. Peak stat gets +50-79 bonus.
  --min-total <val>        Require sum of all stats >= val (max ~450 legendary)
  --max-attempts <n>       Max attempts (default 10,000,000)

  --survey <n>             Survey mode: search n million seeds and show the top 20
                           results ranked by total stats. Applies all filters.
                           Does not patch — just prints a leaderboard.

Examples:
  bun reroll_bruteforce.js legendary --shiny
  bun reroll_bruteforce.js legendary --shiny --species dragon --min-stat debugging:90
  bun reroll_bruteforce.js epic --min-total 400 --species ghost
  bun reroll_bruteforce.js legendary --hat crown --eye ✦ --min-stat chaos:80
  bun reroll_bruteforce.js legendary --shiny --survey 50`);
    process.exit(0);
}

// Read user ID from ~/.claude.json
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

function loadUserId() {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf-8"));
    return cfg.oauthAccount?.accountUuid ?? cfg.userID ?? "anon";
  } catch {
    console.error("Could not read ~/.claude.json — make sure Claude Code is installed and you've logged in.");
    process.exit(1);
  }
}

const USER_ID = loadUserId();
const ORIGINAL_SALT = "friend-2026-401";
const SALT_LEN = ORIGINAL_SALT.length; // 15

const SPECIES = ["duck","goose","blob","cat","dragon","octopus","owl","penguin","turtle","snail","ghost","axolotl","capybara","cactus","robot","rabbit","mushroom","chonk"];
const EYES = ["·","✦","×","◉","@","°"];
const HATS = ["none","crown","tophat","propeller","halo","wizard","beanie","tinyduck"];
const RARITY_ORDER = ["common","uncommon","rare","epic","legendary"];
const WEIGHTS = {common:60,uncommon:25,rare:10,epic:4,legendary:1};
const FLOORS = {common:5,uncommon:15,rare:25,epic:35,legendary:50};
const STAT_NAMES = ["debugging","patience","chaos","wisdom","snark"];
const STARS = {common:"★",uncommon:"★★",rare:"★★★",epic:"★★★★",legendary:"★★★★★"};

function oN4(H) {
    let _ = H >>> 0;
    return function() {
        _ |= 0;
        _ = _ + 1831565813 | 0;
        let q = Math.imul(_ ^ _ >>> 15, 1 | _);
        q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q;
        return ((q ^ q >>> 14) >>> 0) / 4294967296;
    };
}

function bunHash(s) {
    return Number(BigInt(Bun.hash(s)) & 0xffffffffn);
}

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789-";
function randomSalt() {
    let s = "";
    for (let i = 0; i < SALT_LEN; i++) {
        s += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return s;
}

function roll(salt) {
    const seed = bunHash(USER_ID + salt);
    const rng = oN4(seed);

    let r = rng() * 100;
    let rarity = "common";
    for (const k of RARITY_ORDER) {
        r -= WEIGHTS[k];
        if (r < 0) { rarity = k; break; }
    }

    const species = SPECIES[Math.floor(rng() * SPECIES.length)];
    const eye = EYES[Math.floor(rng() * EYES.length)];
    const hat = rarity === "common" ? "none" : HATS[Math.floor(rng() * HATS.length)];
    const shiny = rng() < 0.01;

    const floor = FLOORS[rarity];
    const peakIdx = Math.floor(rng() * STAT_NAMES.length) % STAT_NAMES.length;
    let dumpIdx = Math.floor(rng() * STAT_NAMES.length) % STAT_NAMES.length;
    while (dumpIdx === peakIdx) dumpIdx = Math.floor(rng() * STAT_NAMES.length) % STAT_NAMES.length;

    const stats = {};
    for (let i = 0; i < STAT_NAMES.length; i++) {
        const rv = rng();
        if (i === peakIdx) stats[STAT_NAMES[i]] = Math.min(100, floor + 50 + Math.floor(rv * 30));
        else if (i === dumpIdx) stats[STAT_NAMES[i]] = Math.max(1, floor - 10 + Math.floor(rv * 15));
        else stats[STAT_NAMES[i]] = floor + Math.floor(rv * 40);
    }

    return { rarity, species, eye, hat, shiny, stats };
}

// --- Find salt for a specific seed ---
const findSaltIdx = process.argv.indexOf("--find-salt");
if (findSaltIdx >= 0) {
  const targetSeed = parseInt(process.argv[findSaltIdx + 1]) >>> 0;
  console.log(`Finding salt that hashes to seed ${targetSeed}...`);
  const start = performance.now();
  for (let i = 0; ; i++) {
    const salt = randomSalt();
    const seed = bunHash(USER_ID + salt);
    if (seed === targetSeed) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      const r = roll(seed);
      console.log(`Found after ${(i+1).toLocaleString()} attempts (${elapsed}s)!`);
      console.log(`  ${r.shiny ? "✨ " : ""}${STARS[r.rarity]} ${r.rarity.toUpperCase()} ${r.species.toUpperCase()}`);
      console.log(`  Salt: ${salt}`);
      console.log(`\nSALT=${salt}`);
      process.exit(0);
    }
    if (i % 1000000 === 0 && i > 0) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      console.log(`  ...${(i / 1e6).toFixed(0)}M attempts (${elapsed}s)`);
    }
  }
}

// --- Parse args ---
const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

function getAllArgs(flag) {
    const results = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === flag && i + 1 < args.length) results.push(args[i + 1]);
    }
    return results;
}

const wantShiny = args.includes("--shiny");
const wantSpecies = getArg("--species")?.toLowerCase() ?? null;
const wantEye = getArg("--eye") ?? null;
const wantHat = getArg("--hat")?.toLowerCase() ?? null;
const minStats = {};
for (const ms of getAllArgs("--min-stat")) {
    const [name, val] = ms.split(":");
    if (!STAT_NAMES.includes(name)) {
        console.error(`Unknown stat: ${name}. Valid: ${STAT_NAMES.join(", ")}`);
        process.exit(1);
    }
    minStats[name] = parseInt(val);
}
const minTotal = parseInt(getArg("--min-total") ?? "0");
const maxAttempts = parseInt(getArg("--max-attempts") ?? "10000000");
const surveyMillions = parseInt(getArg("--survey") ?? "0");

// Rarity target (first positional arg)
const targetArg = args.find(a => !a.startsWith("-") && RARITY_ORDER.includes(a)) ?? "legendary";
const targets = new Set(
    targetArg === "epic" ? ["epic", "legendary"] : [targetArg]
);

// Validate species/eye/hat
if (wantSpecies && !SPECIES.includes(wantSpecies)) {
    console.error(`Unknown species: ${wantSpecies}. Valid: ${SPECIES.join(", ")}`);
    process.exit(1);
}
if (wantEye && !EYES.includes(wantEye)) {
    console.error(`Unknown eye: ${wantEye}. Valid: ${EYES.join(", ")}`);
    process.exit(1);
}
if (wantHat && !HATS.includes(wantHat)) {
    console.error(`Unknown hat: ${wantHat}. Valid: ${HATS.join(", ")}`);
    process.exit(1);
}

// --- Shared helpers ---
const criteria = [];
if (wantShiny) criteria.push("SHINY");
criteria.push([...targets].join("/").toUpperCase());
if (wantSpecies) criteria.push(wantSpecies.toUpperCase());
if (wantEye) criteria.push(`eye=${wantEye}`);
if (wantHat) criteria.push(`hat=${wantHat}`);
for (const [k, v] of Object.entries(minStats)) criteria.push(`${k}>=${v}`);
if (minTotal > 0) criteria.push(`total>=${minTotal}`);

function matches(r) {
    if (!targets.has(r.rarity)) return false;
    if (wantShiny && !r.shiny) return false;
    if (wantSpecies && r.species !== wantSpecies) return false;
    if (wantEye && r.eye !== wantEye) return false;
    if (wantHat && r.hat !== wantHat) return false;
    const total = Object.values(r.stats).reduce((a, b) => a + b, 0);
    if (total < minTotal) return false;
    for (const [k, v] of Object.entries(minStats)) {
        if (r.stats[k] < v) return false;
    }
    return true;
}

function statTotal(r) {
    return Object.values(r.stats).reduce((a, b) => a + b, 0);
}

function formatResult(r, salt, { rank, compact } = {}) {
    const total = statTotal(r);
    const lines = [];
    const prefix = rank != null ? `#${String(rank).padStart(2)}  ` : "  ";
    const shinyTag = r.shiny ? "✨ " : "";
    const shinyEnd = r.shiny ? " ✨" : "";

    if (compact) {
        const statsStr = STAT_NAMES.map(s => `${s.slice(0,3)}:${r.stats[s]}`).join(" ");
        lines.push(
            `${prefix}${shinyTag}${STARS[r.rarity]} ${r.rarity.toUpperCase()} ${r.species.toUpperCase()}${shinyEnd}` +
            `  ${r.eye} ${r.hat.padEnd(9)}  ${statsStr}  Σ${total}  salt=${salt}`
        );
    } else {
        lines.push(`${shinyTag}${STARS[r.rarity]} ${r.rarity.toUpperCase()} ${r.species.toUpperCase()}${shinyEnd}`);
        lines.push(`  Eye: ${r.eye}  Hat: ${r.hat}`);
        for (const s of STAT_NAMES) {
            const v = r.stats[s];
            const bar = "█".repeat(Math.floor(v / 10)) + "░".repeat(10 - Math.floor(v / 10));
            lines.push(`  ${s.padEnd(10)} ${bar} ${String(v).padStart(3)}`);
        }
        lines.push(`  ${"─".repeat(30)}`);
        lines.push(`  Total: ${total}`);
        lines.push(`  Salt:  ${salt}`);
    }
    return lines.join("\n");
}

// --- Survey mode ---
if (surveyMillions > 0) {
    const totalAttempts = surveyMillions * 1_000_000;
    const TOP_N = 20;

    console.log(`=== Survey Mode: ${surveyMillions}M seeds ===`);
    console.log(`Filter: ${criteria.join(" ")}`);
    console.log(`Keeping top ${TOP_N} by total stats\n`);

    // Min-heap of top N results (sorted by total ascending, so we can drop the worst)
    const board = []; // { total, result, salt }
    let minOnBoard = 0;
    let matchCount = 0;
    const start = performance.now();

    for (let i = 0; i < totalAttempts; i++) {
        const salt = randomSalt();
        const r = roll(salt);

        if (!matches(r)) continue;
        matchCount++;

        const total = statTotal(r);
        if (board.length < TOP_N) {
            board.push({ total, result: r, salt });
            if (board.length === TOP_N) {
                board.sort((a, b) => a.total - b.total);
                minOnBoard = board[0].total;
            }
        } else if (total > minOnBoard) {
            board[0] = { total, result: r, salt };
            board.sort((a, b) => a.total - b.total);
            minOnBoard = board[0].total;
        }

        if ((i + 1) % 2_000_000 === 0) {
            const elapsed = ((performance.now() - start) / 1000).toFixed(1);
            const rate = Math.floor((i + 1) / (performance.now() - start) * 1000);
            const best = board.length > 0 ? board[board.length - 1].total : 0;
            console.log(`  ...${((i + 1) / 1e6).toFixed(0)}M (${elapsed}s, ${rate.toLocaleString()}/s) — ${matchCount} matches, best total: ${best}`);
        }
    }

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`\nDone: ${totalAttempts.toLocaleString()} seeds in ${elapsed}s — ${matchCount.toLocaleString()} matches\n`);

    if (board.length === 0) {
        console.log("No matches found.");
        process.exit(1);
    }

    // Sort descending by total
    board.sort((a, b) => b.total - a.total);

    console.log(`${"=".repeat(120)}`);
    console.log(`  TOP ${board.length} RESULTS`);
    console.log(`${"=".repeat(120)}`);
    for (let i = 0; i < board.length; i++) {
        const { result, salt } = board[i];
        console.log(formatResult(result, salt, { rank: i + 1, compact: true }));
    }
    console.log(`${"=".repeat(120)}`);

    // Show #1 in full detail
    console.log(`\n=== #1 BEST ===\n`);
    console.log(formatResult(board[0].result, board[0].salt));
    console.log(`\nSALT=${board[0].salt}`);
    process.exit(0);
}

// --- Normal mode: find first match ---
console.log(`Searching for: ${criteria.join(" ")}`);
console.log(`User: ${USER_ID}`);
console.log(`Max attempts: ${maxAttempts.toLocaleString()}`);
console.log();

let bestTotal = 0;
let bestResult = null;
let bestSalt = null;
let attempts = 0;
const start = performance.now();

while (attempts < maxAttempts) {
    attempts++;
    const salt = randomSalt();
    const r = roll(salt);

    if (matches(r)) {
        const elapsed = ((performance.now() - start) / 1000).toFixed(1);
        console.log(`Found after ${attempts.toLocaleString()} attempts (${elapsed}s)!\n`);
        console.log(`${"=".repeat(50)}`);
        console.log(formatResult(r, salt));
        console.log(`${"=".repeat(50)}`);
        console.log(`\nSALT=${salt}`);
        process.exit(0);
    }

    // Track best near-miss
    if (targets.has(r.rarity) && (!wantShiny || r.shiny) && (!wantSpecies || r.species === wantSpecies)) {
        const total = statTotal(r);
        if (total > bestTotal) {
            bestTotal = total;
            bestResult = r;
            bestSalt = salt;
        }
    }

    if (attempts % 500000 === 0) {
        const elapsed = ((performance.now() - start) / 1000).toFixed(1);
        const rate = Math.floor(attempts / (performance.now() - start) * 1000);
        let msg = `  ...${(attempts / 1e6).toFixed(1)}M attempts (${elapsed}s, ${rate.toLocaleString()}/s)`;
        if (bestResult) msg += ` — best so far: total=${bestTotal} ${bestResult.species}`;
        console.log(msg);
    }
}

const elapsed = ((performance.now() - start) / 1000).toFixed(1);
console.log(`\nNo exact match after ${maxAttempts.toLocaleString()} attempts (${elapsed}s).`);
if (bestResult) {
    console.log(`\nBest near-miss:\n${formatResult(bestResult, bestSalt)}`);
    console.log(`\nSALT=${bestSalt}`);
}
process.exit(1);
