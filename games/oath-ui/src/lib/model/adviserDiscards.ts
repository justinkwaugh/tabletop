import {
    adviserDiscardsNeeded,
    adviserPlayDiscardSets,
    type HydratedOathGameState
} from '@tabletop/oath'

/**
 * R-5.1.4.II, R-7.6.4 — how many advisers an adviser play must discard, the discards the engine accepts for it, and
 * the advisers in any of them.
 */
export type AdviserRoom = { needed: number; discardable: string[]; discards: string[][] }

export const NO_ROOM: AdviserRoom = { needed: 0, discardable: [], discards: [] }

export function adviserRoom(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    options: { faceUp?: boolean; fromAdvisers?: boolean }
): AdviserRoom {
    const needed = adviserDiscardsNeeded(state, playerId, cardId, options)
    if (needed === 0) return NO_ROOM
    const discards = adviserPlayDiscardSets(state, playerId, cardId, options)
    const discardable = state
        .getPlayerState(playerId)
        .knownAdviserIds()
        .filter((id) => discards.some((discard) => discard.includes(id)))
    return { needed, discardable, discards }
}

/** The discard a placement is judged with: the first the engine accepts, or none when it accepts none. */
export function firstDiscard(room: AdviserRoom): string[] {
    return room.discards[0] ?? []
}

/** The advisers offered once `picked` are chosen: those an accepted discard holds with them; all of them once every pick is made. */
export function offeredDiscards(room: AdviserRoom, picked: readonly string[]): string[] {
    if (picked.length >= room.needed) return room.discardable
    return room.discardable.filter((id) =>
        room.discards.some((discard) => holds(discard, [...picked, id]))
    )
}

/** Picks kept in the order made, held to the number needed and to a discard the engine accepts. */
export function toggledDiscard(
    picked: readonly string[],
    room: AdviserRoom,
    cardId: string
): string[] {
    if (picked.includes(cardId)) return picked.filter((id) => id !== cardId)
    if (picked.length >= room.needed) return [...picked]
    const next = [...picked, cardId]
    return room.discards.some((discard) => holds(discard, next)) ? next : [...picked]
}

function holds(discard: readonly string[], picked: readonly string[]): boolean {
    return picked.every((id) => discard.includes(id))
}
