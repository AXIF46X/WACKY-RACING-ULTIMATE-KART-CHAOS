// Headless smoke test: build every track, kart and character, validate geometry.
import { TRACKS, VEHICLES, CHARACTERS, HATS } from "../src/game/data";
import { buildTrack, buildKart, buildDriver } from "../src/game/builders";

let failures = 0;
const bad = (msg: string) => { failures++; console.error("FAIL:", msg); };

for (const t of TRACKS) {
  const built = buildTrack(t);
  if (built.samples.length !== 700) bad(`${t.id}: ${built.samples.length} samples`);
  let nan = false;
  for (const s of built.samples) {
    if (!isFinite(s.pos.x) || !isFinite(s.pos.z) || !isFinite(s.tan.x) || !isFinite(s.lat.x)) nan = true;
  }
  if (nan) bad(`${t.id}: NaN sample`);
  if (!(built.length > 200)) bad(`${t.id}: short length ${built.length.toFixed(0)}`);
  if (built.pickupSpots.length === 0) bad(`${t.id}: no pickups`);
  if (built.coinSpots.length === 0) bad(`${t.id}: no coins`);
  let children = 0;
  built.group.traverse(() => children++);
  if (children < 100) bad(`${t.id}: sparse scene (${children})`);
  console.log(`track ${t.id.padEnd(18)} len=${built.length.toFixed(0)} nodes=${children} obstacles=${built.obstacles.length} pickups=${built.pickupSpots.length} coins=${built.coinSpots.length}`);
}

for (const v of VEHICLES) {
  const k = buildKart(v, "#e4572e", "classic");
  let nan = false;
  k.group.traverse((o) => {
    if (!isFinite(o.position.x + o.position.y + o.position.z)) nan = true;
  });
  if (nan) bad(`${v.id}: NaN node`);
  let count = 0;
  k.group.traverse(() => count++);
  if (count < 5) bad(`${v.id}: too few parts (${count})`);
  console.log(`kart  ${v.id.padEnd(18)} parts=${count} wheels=${k.wheels.length}`);
}

for (const c of CHARACTERS) {
  for (const h of ["none", "crown", "duck-hat", "viking"] as const) {
    const d = buildDriver(c, h);
    let count = 0;
    d.group.traverse(() => count++);
    if (count < 5) bad(`${c.id}/${h}: too few parts`);
  }
}
console.log(`characters OK (${CHARACTERS.length} chars x hats)`);
console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
