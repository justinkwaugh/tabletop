import { Alliance } from '../model/gameState.js'

// True if the two regions are linked by an existing alliance (in either order) -
// used both to block expansion between allied regions and to prevent creating a
// duplicate alliance for a pair that's already allied.
export function areRegionsAllied(alliances: Alliance[], regionIdA: string, regionIdB: string): boolean {
    return alliances.some(
        (a) =>
            (a.regionAId === regionIdA && a.regionBId === regionIdB) ||
            (a.regionAId === regionIdB && a.regionBId === regionIdA)
    )
}
