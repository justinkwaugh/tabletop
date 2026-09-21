import { describe, expect, it } from 'vitest'
import {
    minimalPlayState,
    minimalTrainRules,
    minimalTransferRules
} from '@tabletop/18xx/testing'
import { TrainBuyingModule, type TrainBuyingContext } from './trainBuyingModule.svelte.js'
import { testContext } from './moduleTestContext.js'

function buying(
    machineState: TrainBuyingContext['state']['machineState'],
    valid: string[],
    availability = {}
) {
    const state: TrainBuyingContext['state'] = {
        ...minimalPlayState(),
        machineState,
        usedPrivatePowerIds: []
    }
    const harness = testContext(
        state,
        { trainRules: minimalTrainRules, transferRules: minimalTransferRules },
        valid,
        availability
    )
    return { ...harness, module: new TrainBuyingModule(harness.context, () => []) }
}

describe('TrainBuyingModule', () => {
    it('can buy only while buying trains, with the action valid and the session interactive', () => {
        expect(buying('BuyingTrains', ['BuyTrain']).module.canBuy).toBe(true)
        expect(buying('StockRound', ['BuyTrain']).module.canBuy).toBe(false)
        expect(buying('BuyingTrains', ['FinishOperatingTurn']).module.canBuy).toBe(false)
        expect(buying('BuyingTrains', ['BuyTrain'], { interactive: false }).module.canBuy).toBe(false)
    })

    it('defaults to the depot source and has no company train choices without purchase options', () => {
        const { module } = buying('BuyingTrains', ['BuyTrain'])
        expect(module.source).toBe('depot')
        expect(module.companyChoices).toEqual([])
        expect(module.limit).toBeUndefined()
    })

    it('unwinds the chosen source as its own Undo step, separately from a depot selection', () => {
        const { module } = buying('BuyingTrains', ['BuyTrain'])
        module.selectSource('others')
        expect(module.source).toBe('others')
        expect(module.sourceStages.hasManual()).toBe(true)
        expect(module.depotChoice.hasManual()).toBe(false)
        expect(module.sourceStages.undo()).toBe(true)
        expect(module.sourceStages.undo()).toBe(false)
    })

    it('hides the chosen source outside train buying but keeps it pending until cleared', () => {
        const { module } = buying('StockRound', [])
        module.selectSource('mine')
        expect(module.source).toBe('depot')
        expect(module.sourceStages.hasManual()).toBe(true)
        module.sourceStages.clear()
        expect(module.sourceStages.hasManual()).toBe(false)
    })

    it('refuses a company train that is not among the choices', () => {
        const { module } = buying('BuyingTrains', ['BuyTrain'])
        expect(() =>
            module.selectCompanyTrain({
                companyId: 'R',
                seller: { kind: 'company', companyId: 'S' },
                asset: { kind: 'train', trainId: 't1' },
                price: 100
            })
        ).toThrow('Choose an available company train')
    })
})
