import {
    Corporations1849,
    GaribaldiId,
    garibaldiHomes,
    nextCorporation1849,
    requireState1849
} from '@tabletop/1849'
import { getCompany } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'

/**
 * Where a corporation stands in the order they start in: started, the one a player may start
 * next, closed until a later stock round, a Garibaldi passed over while none of its cities has
 * room, or waiting its turn.
 */
export type StartStanding =
    | { kind: 'started' }
    | { kind: 'next' }
    | { kind: 'closed'; stockRound: number }
    | { kind: 'no-home' }
    | { kind: 'waiting' }

export type StartOrderEntry = {
    companyId: string
    name: string
    /** The cities its home may be in: one, or the Garibaldi's choice (§9.4.1). */
    homeLocationIds: readonly string[]
    standing: StartStanding
}

/**
 * The corporations in the order they may start, as dealt at setup and changed since: a passed
 * over Garibaldi and a closed corporation go last (§2.2, §9.4, §9.4.1, §11).
 */
export function startOrder(stateObject: object): StartOrderEntry[] {
    const state = requireState1849(stateObject)
    const next = nextCorporation1849(state)
    return state.corporationOrder.map((companyId) => {
        const corporation = Corporations1849.find((entry) => entry.id === companyId)
        assertExists(corporation, `Unknown 1849 corporation ${companyId}`)
        const restart = state.restarts.find((entry) => entry.companyId === companyId)
        const standing: StartStanding = getCompany(state, companyId).started
            ? { kind: 'started' }
            : companyId === next
              ? { kind: 'next' }
              : restart && state.stockRound.number < restart.stockRound
                ? { kind: 'closed', stockRound: restart.stockRound }
                : companyId === GaribaldiId && !garibaldiHomes(state, 0).length
                  ? { kind: 'no-home' }
                  : { kind: 'waiting' }
        return {
            companyId,
            name: corporation.name,
            homeLocationIds: corporation.homeLocationIds,
            standing
        }
    })
}
