/** Module-private key for {@link BTree} structural checks. Not re-exported from the barrel. */
export const checkInvariants: unique symbol = Symbol('atomic-fns.BTree.checkInvariants')

/**
 * Pairwise shape-element vs target-element comparisons inside one matches array-subset scan.
 * Not exported from any public barrel; tests import this module directly.
 */
let subsetPairComparisons = 0

/** Reset the subset-scan pairwise comparison counter (tests). */
export function resetSubsetPairComparisons(): void {
  subsetPairComparisons = 0
}

/** Read the subset-scan pairwise comparison counter (tests). */
export function getSubsetPairComparisons(): number {
  return subsetPairComparisons
}

/** Record one shape-element vs target-element comparison in a subset scan. */
export function noteSubsetPairComparison(): void {
  subsetPairComparisons++
}

/**
 * Distinct containers expanded while building matches leaf-key indexes in one call.
 * Not exported from any public barrel; tests import this module directly.
 */
let leafKeyVisits = 0

/** Reset the leaf-key visit counter (tests). */
export function resetLeafKeyVisits(): void {
  leafKeyVisits = 0
}

/** Read the leaf-key visit counter (tests). */
export function getLeafKeyVisits(): number {
  return leafKeyVisits
}

/** Record one distinct-container expansion in a leaf-key index walk. */
export function noteLeafKeyVisit(): void {
  leafKeyVisits++
}
