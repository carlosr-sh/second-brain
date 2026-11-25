/**
 * Fractional ordering: an item's position is a REAL, and dropping it between
 * two neighbors takes the midpoint. Moving one card updates ONE row instead
 * of renumbering the whole column.
 */
export function positionBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined) return (next as number) - 1;
  if (next === undefined) return prev + 1;
  return (prev + next) / 2;
}

/** Position for an item dropped at `index` in a column (the list must NOT include the moved item). */
export function positionAtIndex(sortedPositions: number[], index: number): number {
  return positionBetween(sortedPositions[index - 1], sortedPositions[index]);
}

/**
 * Given the FINAL order of a column (ids, including the moved one), returns
 * the new position for `movedId` from its neighbors' current positions.
 */
export function positionInOrder(order: string[], movedId: string, positionOf: (id: string) => number): number {
  const i = order.indexOf(movedId);
  const prev = i > 0 ? positionOf(order[i - 1] as string) : undefined;
  const next = i >= 0 && i < order.length - 1 ? positionOf(order[i + 1] as string) : undefined;
  return positionBetween(prev, next);
}
