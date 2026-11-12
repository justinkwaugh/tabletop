import {
    Corporations1849,
    GaribaldiId,
    garibaldiHomes,
    nextCorporation1849,
    requireState1849,
    startOrder1849
} from '@tabletop/1849'
import { getCompany, homeStationId } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'

/**
 * Where a corporation stands in the order they start in: started, the one a player may start
 * next, closed until a later stock round, a Garibaldi set aside for want of room or back from the
 * next stock round, or waiting its turn.
 */
export type StartStanding =
    | { kind: 'started' }
    | { kind: 'next' }
    | { kind: 'closed'; stockRound: number }
    | { kind: 'no-home' }
    | { kind: 'returning'; stockRound: number }
    | { kind: 'waiting' }

export type StartOrderEntry = {
    companyId: string
    name: string
    /** Its home: the city its home station stands in, else the cities it may start in (§9.4.1). */
    homeLocationIds: readonly string[]
    standing: StartStanding
}

/**
 * The corporations in the order they may start, as dealt at setup and changed since: a Garibaldi
 * set aside and a closed corporation go last (§2.2, §9.4, §9.4.1, §11).
 */
export function startOrder(stateObject: object): StartOrderEntry[] {
    const state = requireState1849(stateObject)
    const next = nextCorporation1849(state)
    return startOrder1849(state).map((companyId) => {
        const corporation = Corporations1849.find((entry) => entry.id === companyId)
        assertExists(corporation, `Unknown 1849 corporation ${companyId}`)
        const home = state.stations.find((station) => station.id === homeStationId(companyId))
        return {
            companyId,
            name: corporation.name,
            homeLocationIds:
                home?.status === 'placed'
                    ? [home.position.locationId]
                    : corporation.homeLocationIds,
            standing: standing(state, companyId, next)
        }
    })
}

function standing(
    state: ReturnType<typeof requireState1849>,
    companyId: string,
    next: string | undefined
): StartStanding {
    if (getCompany(state, companyId).started) return { kind: 'started' }
    if (companyId === next) return { kind: 'next' }
    const restart = state.restarts.find((entry) => entry.companyId === companyId)
    if (restart && state.stockRound.number < restart.stockRound)
        return { kind: 'closed', stockRound: restart.stockRound }
    if (companyId === GaribaldiId) {
        // Room that opens after a stock round has begun waits for the next one (§9.4.1).
        if (!garibaldiHomes(state, 0).length) return { kind: 'no-home' }
        if (state.garibaldiAside)
            return { kind: 'returning', stockRound: state.stockRound.number + 1 }
    }
    return { kind: 'waiting' }
}
