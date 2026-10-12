export function createStickDirections(length: number, random = Math.random) {
  return Array.from({ length }, () =>
    Array.from({ length: 7 }, () => random() < 0.5),
  );
}
