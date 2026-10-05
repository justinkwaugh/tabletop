import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    EarningsDistribution,
    companyMarketSpace,
    placeStockMarker,
    finiteCashOwnedBy,
    certificatesOwnedBy,
    type EarningsChoice
} from '@tabletop/18xx'
import { EarningsRules1846 } from './earnings.js'
import { stockGame } from './testSupport.js'

function constructionGame() {
    const table = stockGame()
    table.launch('IC', 100)
    for (let i = 0; i < 4; i++) table.finishTurn()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    table.act('CorporateFinance', { companyId: 'IC', operation: 'pass', shares: 0, amount: 0 })
    return table
}
function preparedEarnings(revenue: number) {
    const table = constructionGame()
    table.state.machineState = 'DistributingEarnings'
    table.state.routeStep = { companyId: 'IC', result: { companyId: 'IC', revenue, routes: [] } }
    return table
}
describe('1846 major earnings', () => {
    it('automatically records no routes and drops the first major price before train buying', () => {
        const table = constructionGame()
        const cash = structuredClone(table.state.cash)
        const result = table.act('FinishTrack', { companyId: 'IC' })
        expect(result.processedActions.map((a) => a.type)).toEqual([
            'FinishTrack',
            'FinishStations',
            'RunTrains',
            'DistributeEarnings'
        ])
        expect(
            result.processedActions.slice(1).every((a) => a.source === ActionSource.System)
        ).toBe(true)
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.cash).toEqual(cash)
        expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(90)
        expect(table.state.earningsDistribution).toMatchObject({
            companyId: 'IC',
            revenue: 0,
            choice: 'withhold'
        })
        expect(table.state.operatingSet?.completedCompanyIds).not.toContain('IC')
        expect(() =>
            table.act('DistributeEarnings', { companyId: 'IC', choice: 'withhold' })
        ).toThrow()
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it('rounds half-pay retention down to $10 and pays treasury but not market holdings', () => {
        const table = preparedEarnings(250)
        const treasury = certificatesOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
        for (const certificate of treasury.slice(0, 5)) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = 'open-market'
        }
        const before = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
        const result = table.act('DistributeEarnings', { companyId: 'IC', choice: 'half-pay' })
        expect(result.processedActions[0].metadata).toMatchObject({
            retained: 120,
            dividendPerShare: 13,
            revenue: 250
        })
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(
            before + 159
        )
        expect(
            table.state.earningsDistribution?.payments.map((p) => p.amount).sort((a, b) => a - b)
        ).toEqual([26, 159])
        expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(112)
    })
    it.each([
        [100, 40, 'pay', 90],
        [100, 50, 'pay', 100],
        [100, 100, 'pay', 112],
        [100, 200, 'pay', 124],
        [150, 500, 'pay', 180],
        [165, 490, 'pay', 195],
        [165, 500, 'pay', 212],
        [550, 2000, 'pay', 550],
        [165, 500, 'half-pay', 180],
        [165, 500, 'withhold', 150]
    ] as const)(
        'moves stock at price %i for revenue %i and %s',
        (price, revenue, choice: EarningsChoice, expected) => {
            const table = preparedEarnings(revenue)
            const space = table.state.stockMarket.spaces.find((space) => space.price === price)
            assertExists(space)
            placeStockMarker(table.state.stockMarket, 'IC', space.id)
            table.act('DistributeEarnings', { companyId: 'IC', choice })
            expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(expected)
        }
    )
    it('preserves stack order when payout holds the price', () => {
        const table = preparedEarnings(50)
        const market = structuredClone(table.state.stockMarket)
        table.act('DistributeEarnings', { companyId: 'IC', choice: 'pay' })
        expect(table.state.stockMarket).toEqual(market)
    })
    it('rejects the wrong actor and fabricated automatic positive-revenue payout', () => {
        const table = preparedEarnings(100)
        expect(() =>
            table.act('DistributeEarnings', { companyId: 'IC', choice: 'pay', playerId: 'p2' })
        ).toThrow()
        expect(() =>
            table.act('DistributeEarnings', {
                companyId: 'IC',
                choice: 'pay',
                source: ActionSource.System
            })
        ).toThrow()
        expect(
            new EarningsDistribution(table.hydrated, EarningsRules1846).evaluate('MS', 'pay')
                .details
        ).toBeUndefined()
    })
    it('closes a corporation whose automatic stock drop reaches zero', () => {
        const table = constructionGame()
        const space = table.state.stockMarket.spaces.find((space) => space.price === 10)
        assertExists(space)
        placeStockMarker(table.state.stockMarket, 'IC', space.id)
        const before = structuredClone(table.state)
        const result = table.act('FinishTrack', { companyId: 'IC' })
        expect(result.processedActions.map((action) => action.type)).toContain('CloseCorporation')
        expect(table.state.machineState).toBe('AssigningSteamboat')
        expect(table.state.companies.find((c) => c.id === 'IC')?.closed).toBe(true)
        expect(table.state.operatingSet?.roundNumber).toBe(2)
        expect(table.state.operatingSet?.companyOrder).not.toContain('IC')
        expect(table.state.activePlayerIds).toHaveLength(1)
        expect(table.state.earningsDistribution).toBeUndefined()
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(0)
        let state = table.state
        for (const action of result.processedActions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(before)
    })
})
