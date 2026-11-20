import { Charters, Mandates, type WritId } from '@tabletop/feudum'

export interface WritGroup {
    readonly name: 'Mandates' | 'Charters'
    readonly writs: readonly WritId[]
}

/** Contract, Supply (R-7): it reads no state, so nothing in it tells where a writ is (R-4.4.4). */
export const WritReference: readonly WritGroup[] = [
    { name: 'Mandates', writs: Mandates.map(({ id }) => id) },
    { name: 'Charters', writs: Charters.map(({ id }) => id) }
]
