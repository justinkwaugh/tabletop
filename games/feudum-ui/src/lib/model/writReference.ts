import { Charters, Mandates, type WritId } from '@tabletop/feudum'

export interface WritGroup {
    readonly name: 'Mandates' | 'Charters'
    readonly writs: readonly WritId[]
}

/**
 * Contract, Supply: every writ in the game, by kind, in the print's order (R-7). It is the game's
 * data and reads no state, so it is the same for every viewer at every step: nothing in it tells
 * where a writ is (R-4.4.1, R-4.4.4).
 */
export const WritReference: readonly WritGroup[] = [
    { name: 'Mandates', writs: Mandates.map(({ id }) => id) },
    { name: 'Charters', writs: Charters.map(({ id }) => id) }
]
