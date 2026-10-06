import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource } from '@tabletop/common'
import {
    TrackConstruction,
    companyMarketSpace,
    finiteCashOwnedBy,
    sharesOwned
} from '@tabletop/18xx'
import { corporateFinanceChoices } from './corporateFinance.js'
import { layTrack, stockGame } from './testSupport.js'
import { TrackRules1846 } from './track.js'

function financeGame() {
    const table = stockGame()
    table.launch()
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    expect(table.state.machineState).toBe('LayingTrack')
    expect(table.state.trackStep?.companyId).toBe('IC')
    return table
}
function putInMarket(table: ReturnType<typeof stockGame>, count: number) {
    const certificates = table.state.certificates
        .filter((c) => !c.retired)
        .filter((c) => c.companyId === 'IC' && c.owner.kind === 'company')
        .slice(0, count)
    for (const certificate of certificates) {
        certificate.owner = { kind: 'bank' }
        certificate.poolId = 'open-market'
    }
}
function choice(
    table: ReturnType<typeof stockGame>,
    operation: 'issue' | 'redeem',
    shares: number
) {
    const found = corporateFinanceChoices(table.hydrated).find(
        (c) => c.operation === operation && c.shares === shares
    )
    assertExists(found, `Expected to ${operation} ${shares}`)
    return found
}
function shareCounts(table: ReturnType<typeof stockGame>, operation: 'issue' | 'redeem') {
    return corporateFinanceChoices(table.hydrated)
        .filter((c) => c.operation === operation)
        .map((c) => c.shares)
}
describe('1846 corporate finance', () => {
    it('issues a complete block during construction without moving price', () => {
        const table = financeGame()
        const beforeMarket = structuredClone(table.state.stockMarket)
        const beforeCash = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
        expect(shareCounts(table, 'issue')).toEqual([1, 2])
        const issue = choice(table, 'issue', 2)
        expect(issue.amount).toBe(60)
        const result = table.act('CorporateFinance', issue)
        expect(table.state.machineState).toBe('LayingTrack')
        expect(table.state.stockMarket).toEqual(beforeMarket)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(
            beforeCash + 60
        )
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(2)
        expect(result.processedActions[0].metadata).toMatchObject({
            operation: 'issue',
            shares: 2,
            amount: 60,
            certificateIds: expect.any(Array)
        })
        expect(corporateFinanceChoices(table.hydrated)).toEqual([])
        expect(() => table.act('CorporateFinance', issue)).toThrow()
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it('issues again after laying track, within the same limit and at the same price', () => {
        const table = financeGame()
        table.act('CorporateFinance', choice(table, 'issue', 1))
        const lay = new TrackConstruction(table.hydrated, TrackRules1846).choices('J4')[0]
        assertExists(lay, 'IC can lay track from its home')
        layTrack(table, lay)
        expect(shareCounts(table, 'issue')).toEqual([1])
        expect(shareCounts(table, 'redeem')).toEqual([])
        const second = choice(table, 'issue', 1)
        expect(second.amount).toBe(30)
        table.act('CorporateFinance', second)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(2)
        expect(corporateFinanceChoices(table.hydrated)).toEqual([])
    })
    it('keeps a redeeming corporation from issuing in the same turn', () => {
        const table = financeGame()
        putInMarket(table, 3)
        expect(shareCounts(table, 'redeem')).toEqual([1, 2])
        table.act('CorporateFinance', choice(table, 'redeem', 1))
        expect(table.state.financeStep).toEqual({ companyId: 'IC', operation: 'redeem' })
        expect(shareCounts(table, 'issue')).toEqual([])
        expect(shareCounts(table, 'redeem')).toEqual([1])
    })
    it('closes once routes have run', () => {
        const table = financeGame()
        table.act('FinishTrack', { companyId: 'IC' })
        expect(table.state.machineState).not.toBe('LayingTrack')
        expect(table.state.machineState).not.toBe('RunningTrains')
        expect(corporateFinanceChoices(table.hydrated)).toEqual([])
    })
    it('deducts market shares from the issue limit and allows affordable redemption', () => {
        const table = financeGame()
        putInMarket(table, 2)
        expect(shareCounts(table, 'issue')).toEqual([])
        const redeem = choice(table, 'redeem', 2)
        expect(redeem.amount).toBe(100)
        table.act('CorporateFinance', redeem)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(20)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(0)
        expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(40)
        expect(
            table.state.certificates.filter(
                (c) => !c.retired && c.companyId === 'IC' && c.poolId === 'open-market'
            )
        ).toHaveLength(0)
    })
    it('limits redemption by cash and uses $600 at the market ceiling', () => {
        const table = financeGame()
        putInMarket(table, 3)
        expect(shareCounts(table, 'redeem')).toEqual([1, 2])
        const space = companyMarketSpace(table.state.stockMarket, 'IC')
        space.price = 550
        expect(shareCounts(table, 'redeem')).toEqual([])
        const cash = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'IC'
        )
        assertExists(cash)
        cash.amount = 1200
        expect(
            corporateFinanceChoices(table.hydrated)
                .filter((c) => c.operation === 'redeem')
                .map((c) => c.amount)
        ).toEqual([600, 1200])
    })
    it('rejects unauthorized actors, stale prices, invalid quantities and other companies', () => {
        const table = financeGame()
        const issue = choice(table, 'issue', 1)
        for (const fields of [
            { playerId: 'p2' },
            { amount: 999 },
            { shares: 3 },
            { shares: 0, amount: 0 },
            { companyId: 'MS' },
            { source: ActionSource.System },
            { operation: 'redeem' }
        ]) {
            expect(() => table.act('CorporateFinance', { ...issue, ...fields })).toThrow()
        }
    })
})
