import { expect, it } from 'vitest'
import type { OperatingState } from './operatingSet.js'
import type { TrainState } from '../trains/train.js'
import { privateIncomePayments } from './startOperatingRound.js'
import { companyCharters } from '../company/companyCharters.js'

const charters = companyCharters(() => ({ shareCounts: {}, privateRevenues: { P: 5 } }))

function state(): OperatingState & TrainState {
    return {
        bank: {},
        companies: [
            { id: 'P', kind: 'private' },
            { id: 'A', kind: 'major' }
        ],
        cash: [],
        certificatePools: [],
        certificates: [
            {
                id: 'P',
                companyId: 'P',
                kind: 'private',
                shares: 0,
                owner: { kind: 'company', companyId: 'A' }
            }
        ],
        trainInventory: { nextTrainNumber: 1, trains: [] }
    }
}

it('pays a private’s printed revenue, or what the title says it earns now', () => {
    expect(privateIncomePayments(state(), { charters })).toEqual([
        { from: { kind: 'bank' }, to: { kind: 'company', companyId: 'A' }, amount: 5 }
    ])
    expect(privateIncomePayments(state(), { charters, privateIncome: () => 0 })).toEqual([])
    expect(privateIncomePayments(state(), { charters, privateIncome: () => 15 })[0].amount).toBe(15)
})
