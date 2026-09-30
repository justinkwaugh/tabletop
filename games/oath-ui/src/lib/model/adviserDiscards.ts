import {
    adviserDiscardable,
    adviserDiscardsNeeded,
    type HydratedOathGameState
} from '@tabletop/oath'

/** R-5.1.4.II, R-7.6.4 — how many advisers an adviser play must discard, and which may go. */
export type AdviserRoom = { needed: number; discardable: string[] }

export function adviserRoom(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    options: { faceUp?: boolean; fromAdvisers?: boolean }
): AdviserRoom {
    const needed = adviserDiscardsNeeded(state, playerId, cardId, options)
    const discardable =
        needed === 0
            ? []
            : state
                  .getPlayerState(playerId)
                  .knownAdvisers()
                  .map((adviser) => adviser.cardId)
                  .filter((id) => id !== cardId && adviserDiscardable(state, playerId, id))
    return { needed, discardable }
}

/** Picks kept in the order made, held to the advisers that may go and to the number needed. */
export function toggledDiscard(
    picked: readonly string[],
    room: AdviserRoom,
    cardId: string
): string[] {
    if (picked.includes(cardId)) return picked.filter((id) => id !== cardId)
    if (!room.discardable.includes(cardId) || picked.length >= room.needed) return [...picked]
    return [...picked, cardId]
}
