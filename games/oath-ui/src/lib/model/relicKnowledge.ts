import type { HydratedOathGameState } from '@tabletop/oath'

// R-6.3, R-9.4 — the relic on a slot is named only by the viewer's own peek.
export function peekedRelicAt(
    state: HydratedOathGameState,
    viewerId: string | undefined,
    slotId: string | undefined
): string | undefined {
    if (viewerId === undefined || slotId === undefined) return undefined
    return state.getPlayerState(viewerId).peekedRelics?.[slotId]
}
