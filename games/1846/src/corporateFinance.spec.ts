import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource } from '@tabletop/common'
import { companyMarketSpace, finiteCashOwnedBy, sharesOwned } from '@tabletop/18xx'
import { corporateFinanceChoices } from './corporateFinance.js'
import { stockGame } from './testSupport.js'

function financeGame() {
    const table = stockGame()
    table.launch()
    table.finishTurn()
    table.finishTurn()
    table.finishTurn()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    expect(table.state.machineState).toBe('CorporateFinance')
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
describe('1846 corporate finance', () => {
    it('hands the first major to its president and issues a complete block without moving price', () => {
        const table = financeGame()
        const beforeMarket = structuredClone(table.state.stockMarket)
        const beforeCash = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
        expect(
            corporateFinanceChoices(table.hydrated)
                .filter((c) => c.operation === 'issue')
                .map((c) => c.shares)
        ).toEqual([1, 2])
        const choice = corporateFinanceChoices(table.hydrated).find(
            (c) => c.operation === 'issue' && c.shares === 2
        )
        assertExists(choice)
        expect(choice.amount).toBe(60)
        const result = table.act('CorporateFinance', choice)
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
        expect(() => table.act('CorporateFinance', choice)).toThrow()
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it('deducts market shares from the issue limit and allows affordable redemption', () => {
        const table = financeGame()
        putInMarket(table, 2)
        const choices = corporateFinanceChoices(table.hydrated)
        expect(choices.filter((c) => c.operation === 'issue')).toHaveLength(0)
        const choice = choices.find((c) => c.operation === 'redeem' && c.shares === 2)
        assertExists(choice)
        expect(choice.amount).toBe(100)
        table.act('CorporateFinance', choice)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(20)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(0)
        expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(40)
        expect(
            table.state.certificates.filter(
                (c) => !c.retired && c.companyId === 'IC' && c.poolId === 'open-market'
            )
        ).toHaveLength(0)
    })
    it('limits redemption by cash, uses $600 at the market ceiling, and permits a pass', () => {
        const table = financeGame()
        putInMarket(table, 3)
        expect(
            corporateFinanceChoices(table.hydrated)
                .filter((c) => c.operation === 'redeem')
                .map((c) => c.shares)
        ).toEqual([1, 2])
        const space = companyMarketSpace(table.state.stockMarket, 'IC')
        space.price = 550
        expect(
            corporateFinanceChoices(table.hydrated).filter((c) => c.operation === 'redeem')
        ).toHaveLength(0)
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
        const beforeCash = structuredClone(table.state.cash)
        table.act('CorporateFinance', { companyId: 'IC', operation: 'pass', shares: 0, amount: 0 })
        expect(table.state.cash).toEqual(beforeCash)
    })
    it('rejects unauthorized actors, stale prices, invalid quantities and other companies', () => {
        const table = financeGame()
        const choice = corporateFinanceChoices(table.hydrated).find((c) => c.operation === 'issue')
        assertExists(choice)
        for (const fields of [
            { playerId: 'p2' },
            { amount: 999 },
            { shares: 3 },
            { companyId: 'MS' },
            { source: ActionSource.System },
            { operation: 'pass' }
        ]) {
            expect(() => table.act('CorporateFinance', { ...choice, ...fields })).toThrow()
        }
    })
})
