// A tiny seeded random source, so a ?seed=N run is reproducible.
// One clear job: deterministic randomness for the world and the shots.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  }
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
