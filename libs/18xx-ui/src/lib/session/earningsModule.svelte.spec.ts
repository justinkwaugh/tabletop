import { describe, expect, it } from 'vitest'
import type { EarningsRules } from '@tabletop/18xx'
import { TestCompanyId, minimalRailwayState } from '@tabletop/18xx/testing'
import { EarningsModule } from './earningsModule.svelte.js'
import { testContext } from './moduleTestContext.js'

const earningsRules: EarningsRules = {
    choices: () => ['pay', 'withhold'],
    shareCount: () => 10,
    entitlements: () => [],
    retainedRevenue: (_state, _id, choice, revenue) => (choice === 'pay' ? 0 : revenue),
    roundDividend: (_state, _id, amount) => amount,
    marketEffect: () => ({ bonusPerShare: 0 })
}

function distributing(
    machineState: 'DistributingEarnings' | 'StockRound' = 'DistributingEarnings',
    availability: { draftsVisible?: boolean; interactive?: boolean } = {}
) {
    const state = {
        ...minimalRailwayState(),
        machineState,
        routeStep: {
            companyId: TestCompanyId,
            result: { companyId: TestCompanyId, routes: [], revenue: 200 }
        }
    }
    const harness = testContext(state, { earningsRules }, ['DistributeEarnings'], availability)
    return { ...harness, earnings: new EarningsModule(harness.context) }
}

describe('EarningsModule', () => {
    it('offers the title choices with their evaluated result while distributing', () => {
        const { earnings } = distributing()
        expect(earnings.choices.map((entry) => entry.choice)).toEqual(['pay', 'withhold'])
        expect(earnings.choices.every((entry) => entry.evaluation.details)).toBe(true)
    })

    it('offers nothing outside the distribution step', () => {
        expect(distributing('StockRound').earnings.choices).toEqual([])
    })

    it('commits the selected distribution as one action', async () => {
        const { earnings, applied } = distributing()
        earnings.select('withhold')
        expect(earnings.preview?.retained).toBe(200)
        await earnings.confirm()
        expect(applied).toMatchObject([
            { type: 'DistributeEarnings', companyId: TestCompanyId, choice: 'withhold' }
        ])
    })

    it('refuses a choice the title does not offer or while interaction is blocked', () => {
        expect(() => distributing().earnings.select('half-pay')).toThrow(
            'Choose an available distribution'
        )
        const blocked = distributing('DistributingEarnings', { interactive: false })
        expect(() => blocked.earnings.select('pay')).toThrow('Choose an available distribution')
    })

    it('hides its selection while drafts are not visible but keeps it pending', () => {
        const { earnings } = distributing('DistributingEarnings', { draftsVisible: false })
        earnings.select('pay')
        expect(earnings.selection).toBeUndefined()
        expect(earnings.pending()).toBe(true)
    })

    it('lets Undo consume the draft once, then yields to game history', () => {
        const { earnings } = distributing()
        earnings.select('pay')
        expect(earnings.unwind()).toBe(true)
        expect(earnings.pending()).toBe(false)
        expect(earnings.unwind()).toBe(false)
    })
})
