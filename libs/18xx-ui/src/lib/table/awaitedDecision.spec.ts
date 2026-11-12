import { describe, expect, it } from 'vitest'
import { TestCompanyId, minimalPlayState } from '@tabletop/18xx/testing'
import type { Owner } from '@tabletop/18xx'
import {
    awaitedDecision,
    type AwaitedDecisionNames,
    type AwaitedDecisionState
} from './awaitedDecision.js'
import { moneyFormat } from '../presentation/money.js'

const names: AwaitedDecisionNames = {
    companyName: (companyId) => `Company ${companyId}`,
    ownerName: (owner: Owner) =>
        owner.kind === 'company'
            ? `Company ${owner.companyId}`
            : owner.kind === 'player'
              ? owner.playerId
              : 'Bank',
    trainName: () => '3',
    money: moneyFormat('$')
}
const trainRules = { trainLimit: () => 2, countsForLimit: () => true }
const owner = { kind: 'company', companyId: TestCompanyId } as const

function state(changes: Partial<AwaitedDecisionState> = {}): AwaitedDecisionState {
    return { ...minimalPlayState(), ...changes }
}

describe('awaitedDecision', () => {
    it('describes nothing while play waits only on its turn', () => {
        expect(awaitedDecision(state(), names, trainRules)).toBeUndefined()
    })

    it('describes a company’s excess trains during another company’s phase change', () => {
        const discarding = state({
            machineState: 'DiscardingTrains',
            phaseChange: {
                event: {
                    id: 'phase:t3',
                    trainId: 't3',
                    definitionId: '3',
                    fromPhaseId: '2',
                    toPhaseId: '3'
                },
                continuation: { machineState: 'BuyingTrains', companyId: 'S' },
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
        })
        expect(awaitedDecision(discarding, names, trainRules)).toEqual({
            title: 'Excess trains',
            companyId: TestCompanyId,
            text: 'Company R must discard 1 train to its limit of 2'
        })
    })

    it('describes a company’s offer for another owner’s train', () => {
        const offering = state({
            purchaseOffer: {
                id: 'offer',
                buyer: { kind: 'company', companyId: 'S' },
                seller: owner,
                asset: { kind: 'train', trainId: 't1' },
                price: 300,
                buyerPlayerId: 'blair',
                sellerPlayerId: 'alex'
            }
        })
        expect(awaitedDecision(offering, names, trainRules)).toEqual({
            title: 'Purchase offer',
            companyId: 'S',
            text: 'Company S offers $300 for Company R’s 3 train'
        })
    })
})
