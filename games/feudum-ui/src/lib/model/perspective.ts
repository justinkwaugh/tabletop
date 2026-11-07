/**
 * Whether a viewer sees a hidden thing's face. Decided from who looks, never from whether the data
 * happens to be present: a Local game holds every field and still shows backs. Host View is its own
 * explicit look at the faces (S57), which its derivation asks for by name; it is no viewer here.
 */

/** R-3.1, R-5.1 A hand's cards: their owner sees faces, everyone else backs and a count. */
export function handFaceShown(viewerId: string | undefined, ownerId: string): boolean {
    return viewerId === ownerId
}

/** R-4.4.4 A writ, sealed or not; R-6.2 sealed charters turn up at final scoring. */
export function writFaceShown(
    viewerId: string | undefined,
    ownerId: string,
    revealedAtGameEnd = false
): boolean {
    return revealedAtGameEnd || viewerId === ownerId
}

/**
 * R-5-H1 A seal red side up is the same crowned disc for everyone, its holder included; only a
 * flip to a bead shows its value, and then to all.
 */
export function sealFaceShown(flippedToBead: boolean): boolean {
    return flippedToBead
}
