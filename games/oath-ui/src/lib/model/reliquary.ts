import { range } from '@tabletop/common'
import { RELIQUARY_SPACES, reliquarySlotId, type HydratedOathGameState } from '@tabletop/oath'

export type ReliquarySpace = { slotId: string; covered: boolean }

/** R-2.3 — each space by its own slot, so an uncovered space never shifts the others. */
export function reliquarySpaces(state: HydratedOathGameState): ReliquarySpace[] {
    const covered = new Set(state.reliquarySlots().map((slot) => slot.slotId))
    return range(0, RELIQUARY_SPACES).map((index) => {
        const slotId = reliquarySlotId(index)
        return { slotId, covered: covered.has(slotId) }
    })
}
