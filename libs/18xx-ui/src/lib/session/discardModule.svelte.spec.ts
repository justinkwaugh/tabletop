import { describe, expect, it } from 'vitest'
import type { EighteenXXTitleRules } from '@tabletop/18xx'
import { TestCompanyId, minimalPlayState } from '@tabletop/18xx/testing'
import { DiscardModule } from './discardModule.svelte.js'
import { testContext } from './moduleTestContext.js'

const owner = { kind: 'company', companyId: TestCompanyId } as const

function discarding(
    trainLimit: number,
    availability: { selectionsVisible?: boolean; interactive?: boolean } = {}
) {
    const state = {
        ...minimalPlayState(),
        machineState: 'DiscardingTrains' as const,
        phaseChange: {
            event: {
                id: 'phase:t3',
                trainId: 't3',
                definitionId: '3',
                fromPhaseId: '2',
                toPhaseId: '3'
            },
            continuation: { machineState: 'BuyingTrains', companyId: TestCompanyId },
            discardCompanyIds: [TestCompanyId]
        },
        trainInventory: {
            depotId: 'trains',
            nextTrainNumber: 4,
            trains: ['t1', 't2', 't3'].map((id) => ({
                id,
                definitionId: '2',
                status: 'owned' as const,
                owner
            }))
        }
    }
    const trainRules: Pick<EighteenXXTitleRules['trainRules'], 'trainLimit'> = {
        trainLimit: () => trainLimit
    }
    const harness = testContext(state, { trainRules }, ['DiscardTrain'], availability)
    return { ...harness, discard: new DiscardModule(harness.context) }
}

describe('DiscardModule', () => {
    it('lists the owning company trains and how many exceed the limit', () => {
        const { discard } = discarding(2)
        expect(discard.companyId).toBe(TestCompanyId)
        expect(discard.trains.map((train) => train.id)).toEqual(['t1', 't2', 't3'])
        expect(discard.excess).toBe(1)
    })

    it('lists nothing once the company is within its limit', () => {
        expect(discarding(3).discard.trains).toEqual([])
    })

    it('commits the selected train as one discard action', async () => {
        const { discard, applied } = discarding(2)
        discard.select('t2')
        await discard.confirm()
        expect(applied).toMatchObject([
            { type: 'DiscardTrain', companyId: TestCompanyId, trainId: 't2' }
        ])
    })

    it('refuses a train that is not discardable or while interaction is blocked', () => {
        expect(() => discarding(2).discard.select('t9')).toThrow(
            'Choose a train for compulsory discard'
        )
        expect(() => discarding(2, { interactive: false }).discard.select('t1')).toThrow(
            'Choose a train for compulsory discard'
        )
    })

    it('lets Undo consume the draft once, and clears it for a new state', () => {
        const { discard } = discarding(2)
        discard.select('t1')
        expect(discard.choice.hasManual()).toBe(true)
        expect(discard.choice.undo()).toBe(true)
        expect(discard.choice.undo()).toBe(false)
        discard.select('t1')
        discard.choice.clear()
        expect(discard.choice.hasManual()).toBe(false)
    })
})
