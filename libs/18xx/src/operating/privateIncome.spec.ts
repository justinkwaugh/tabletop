import { expect, it } from 'vitest'
import type { OperatingState } from './operatingSet.js'
import type { TrainState } from '../trains/train.js'
import { privateIncomePayments } from './startOperatingRound.js'

function state(): OperatingState & TrainState {
    return {
        bank: {},
        companies: [
            { id: 'P', kind: 'private', privateRevenue: 5 },
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
        trainInventory: { depotId: 'trains', nextTrainNumber: 1, trains: [] }
    }
}

it('pays a private’s printed revenue, or what the title says it earns now', () => {
    expect(privateIncomePayments(state(), {})).toEqual([
        { from: { kind: 'bank' }, to: { kind: 'company', companyId: 'A' }, amount: 5 }
    ])
    expect(privateIncomePayments(state(), { privateIncome: () => 0 })).toEqual([])
    expect(privateIncomePayments(state(), { privateIncome: () => 15 })[0].amount).toBe(15)
})
