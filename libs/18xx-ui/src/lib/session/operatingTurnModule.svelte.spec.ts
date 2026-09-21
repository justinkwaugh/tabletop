import { describe, expect, it } from 'vitest'
import { TestCompanyId, minimalPlayState, minimalTrainRules } from '@tabletop/18xx/testing'
import {
    OperatingTurnModule,
    type OperatingTurnSession
} from './operatingTurnModule.svelte.js'
import { testSession } from './moduleTestSession.js'

type State = OperatingTurnSession['state']

function operating(overrides: Partial<State>, valid: string[], availability = {}) {
    const state: State = $state({
        ...minimalPlayState(),
        machineState: 'LayingTrack',
        trackStep: { companyId: TestCompanyId, lays: [], completed: false },
        usedPrivatePowerIds: [],
        ...overrides
    })
    const finished: string[] = []
    let localSelection = false
    let trainSelected = false
    const harness = testSession(state, { trainRules: minimalTrainRules }, valid, availability)
    const module = new OperatingTurnModule(harness.session, {
        finishTrack: async () => {
            finished.push('track')
            state.machineState = 'PlacingStation'
        },
        finishStations: async () => {
            finished.push('stations')
            state.machineState = 'RunningTrains'
        },
        trainSelected: () => trainSelected,
        hasLocalSelection: () => localSelection
    })
    return {
        ...harness,
        module,
        state,
        finished,
        selectLocally: () => { localSelection = true },
        selectTrain: () => { trainSelected = true }
    }
}
const purchaseOffer: NonNullable<State['purchaseOffer']> = {
    id: 'offer',
    companyId: TestCompanyId,
    asset: { kind: 'private', privateCompanyId: 'P' },
    seller: { kind: 'player', playerId: 'blake' },
    price: 10,
    buyerPlayerId: 'alex',
    sellerPlayerId: 'blake'
}

describe('OperatingTurnModule', () => {
    it('reports the operating step of the machine state, and none outside operation', () => {
        expect(operating({}, []).module.step).toBe(0)
        expect(operating({ machineState: 'BuyingTrains' }, []).module.step).toBe(4)
        expect(operating({ machineState: 'StockRound' }, []).module.step).toBeUndefined()
    })

    it('skips forward only, no further than running trains, and only when finishing is valid', () => {
        const { module } = operating({}, ['FinishTrack'])
        expect(module.canSkipTo(1)).toBe(true)
        expect(module.canSkipTo(2)).toBe(true)
        expect(module.canSkipTo(0)).toBe(false)
        expect(module.canSkipTo(3)).toBe(false)
        expect(operating({}, []).module.canSkipTo(1)).toBe(false)
        expect(operating({}, ['FinishTrack'], { interactive: false }).module.canSkipTo(1)).toBe(false)
    })

    it('does not skip past a local selection or a pending company decision', () => {
        const local = operating({}, ['FinishTrack'])
        local.selectLocally()
        expect(local.module.canSkipTo(1)).toBe(false)
        expect(operating({ purchaseOffer }, ['FinishTrack']).module.canSkipTo(1)).toBe(false)
    })

    it('finishes each step in turn until the target step', async () => {
        const { module, finished } = operating({}, ['FinishTrack', 'FinishStations'])
        await module.skipTo(2)
        expect(finished).toEqual(['track', 'stations'])
        expect(module.step).toBe(2)
    })

    it('stops skipping when stations cannot be finished', async () => {
        const { module, finished } = operating({}, ['FinishTrack'])
        await module.skipTo(2)
        expect(finished).toEqual(['track'])
        expect(module.step).toBe(1)
    })

    it('cannot finish the turn while a train is selected or finishing is not valid', async () => {
        const buying: Partial<State> = {
            machineState: 'BuyingTrains',
            trainPurchaseStep: { companyId: TestCompanyId, purchasedTrainIds: [] }
        }
        const ready = operating(buying, ['FinishOperatingTurn'])
        expect(ready.module.canFinish).toBe(true)
        await ready.module.finish()
        expect(ready.applied[0]).toMatchObject({ type: 'FinishOperatingTurn', companyId: TestCompanyId })

        const selecting = operating(buying, ['FinishOperatingTurn'])
        selecting.selectTrain()
        expect(selecting.module.canFinish).toBe(false)
        await expect(operating(buying, []).module.finish()).rejects.toThrow()
    })
})
