import { HydratedPeek, type HydratedOathGameState } from '@tabletop/oath'

// R-6.3, R-9.4 — the relic on a slot is named only by the viewer's own peek.
export function peekedRelicAt(
    state: HydratedOathGameState,
    viewerId: string | undefined,
    slotId: string | undefined
): string | undefined {
    if (viewerId === undefined || slotId === undefined) return undefined
    return state.getPlayerState(viewerId).peekedRelics?.[slotId]
}

/** R-6.3 — the relics a Peek can show the player that they have not already seen. */
export function unseenPeekSlots(state: HydratedOathGameState, playerId: string): string[] {
    return HydratedPeek.legalTargets(state, playerId)
        .map((target) => target.slotId)
        .filter((slotId) => peekedRelicAt(state, playerId, slotId) === undefined)
}
