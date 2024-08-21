/**
 * Returns a new array that is a shuffled version of the input array.
 * The shuffling is deterministic and reproducible based on the provided seed.
 *
 * @param {T[]} array - The input array to be shuffled.
 * @param {number} seed - The seed used to generate the shuffled array.
 * @return {T[]} A new array that is a shuffled version of the input array.
 */
function seededShuffle<T>(array: T[], seed: number) {
  const shuffled = array.slice();
  let currentSeed = seed;

  const random = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };

  // Fisher-Yates
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
