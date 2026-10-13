import fs from 'fs';
import { generateRun } from '../src/core/run.js';

const load = f => JSON.parse(fs.readFileSync(`data/${f}.json`, 'utf8'));
const data = {
  config: load('config'), races: load('races'), archetypes: load('archetypes'),
  sizes: load('sizes'), powers: load('powers'), tags: load('tags'),
  traits: load('traits'), weapons: load('weapons'), pools: load('pools'),
  scenarios: {} // <-- copy how sim/run.js loads scenarios if runs need them
};

const N = 10000;
const byRace = {}, byArch = {};
for (let i = 0; i < N; i++) {
  const r = generateRun(data, `tbl_${i}`);
  const c = r.character;                                  // <-- check name
  const race = c.race, arch = c.archetype;                // <-- check names
  const R = (byRace[race] ??= { n: 0, weapons: 0, lvl: 0, ranks: [0,0,0,0,0,0] });
  const A = (byArch[arch] ??= { n: 0, ranks: [0,0,0,0,0,0] });
  R.n++; A.n++;
  if (c.weapon) {                                         // <-- check name
    R.weapons++;
    const t = data.weapons.types[c.weapon.type];
    const e = data.weapons.enchantments[c.weapon.enchantment];
    R.lvl += t.level + (e?.levelBonus ?? 0);
  }
  for (const p of c.powers ?? []) {                       // <-- check name
    const rank = data.powers[p]?.rank ?? 1;
    R.ranks[rank]++; A.ranks[rank]++;
  }
}

console.log('RACE | n | weapon% | mean weapon lvl | power ranks 1..5 (%)');
for (const [k, v] of Object.entries(byRace)) {
  const tot = v.ranks.reduce((a, b) => a + b, 0) || 1;
  console.log(k.padEnd(12), v.n, (100*v.weapons/v.n).toFixed(0)+'%',
    v.weapons ? (v.lvl/v.weapons).toFixed(2) : '-',
    v.ranks.slice(1).map(x => (100*x/tot).toFixed(0)).join('/'));
}
console.log('\nARCHETYPE | n | power ranks 1..5 (%)');
for (const [k, v] of Object.entries(byArch)) {
  const tot = v.ranks.reduce((a, b) => a + b, 0) || 1;
  console.log(k.padEnd(12), v.n, v.ranks.slice(1).map(x => (100*x/tot).toFixed(0)).join('/'));
}