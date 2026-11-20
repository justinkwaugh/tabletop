/** docs/hidden-information.md: decided from who looks, never from what data is present; a Local game holds every field. */

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

/** R-5-H1 A seal is the same crowned disc to all, its holder included, until flipped. */
export function sealFaceShown(flippedToBead: boolean): boolean {
    return flippedToBead
}
