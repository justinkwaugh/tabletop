import { Market1846 } from './stock.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    trainsOwnedBy,
    controllingOwner,
    finiteCashOwnedBy,
    nextOperatingCompany,
    placeStockMarker
} from '@tabletop/18xx'
import { stockGame } from './testSupport.js'
import { RouteRules1846 } from './routes.js'
import { trainBuyingChoices1846 } from './trains.js'
import { corporateFinanceChoices } from './corporateFinance.js'

function twoMajors() {
    const table = stockGame()
    table.launch('IC', 40)
    table.launch('NYC', 100)
    table.finishStockRound()
    expect(table.state.operatingSet?.companyOrder).toEqual(['MS', 'BIG4', 'IC', 'NYC'])
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    return table
}
function operate(table: ReturnType<typeof stockGame>, companyId: string, buy = false) {
    table.act('FinishTrack', { companyId })
    if (table.state.machineState === 'RunningTrains') {
        const train = trainsOwnedBy(table.state, { kind: 'company', companyId })[0]
        assertExists(train)
        const evaluation = new RouteEvaluation(table.hydrated, RouteRules1846)
        const routes = evaluation.network.centers().flatMap((start) =>
            evaluation.network.extensions(start, []).flatMap((first) =>
                evaluation.network.extensions(start, [first]).map((second) => ({
                    trainId: train.id,
                    start,
                    paths: [first, second]
                }))
            )
        )
        const route = routes.find((route) => evaluation.evaluateRoute(companyId, route).result)
        assertExists(route, 'The printed network provides a two-stop route')
        table.act('RunTrains', { companyId, routes: [route] })
        expect(table.state.machineState).toBe('DistributingEarnings')
        expect(table.state.routeStep?.result?.revenue).toBeGreaterThan(0)
        table.act('DistributeEarnings', { companyId, choice: 'pay' })
    }
    expect(table.state.machineState).toBe('BuyingTrains')
    if (buy) {
        const choice = trainBuyingChoices1846(table.hydrated)?.offers[0]
        assertExists(choice)
        const { price, ...request } = choice
        table.act('BuyTrain', { ...request, expectedPrice: price })
    }
    return table.act('FinishOperatingTurn', { companyId })
}
describe('1846 stock and operating sequence', () => {
    it("clears a corporation's issue or redeem direction when the next turn starts", () => {
        const table = twoMajors()
        const issue = corporateFinanceChoices(table.hydrated).find(
            (choice) => choice.operation === 'issue'
        )
        assertExists(issue)
        table.act('CorporateFinance', issue)
        expect(table.state.financeStep).toEqual({ companyId: 'IC', operation: 'issue' })
        operate(table, 'IC', true)
        expect(nextOperatingCompany(table.state)).toBe('NYC')
        expect(table.state.financeStep).toBeUndefined()
        expect(
            corporateFinanceChoices(table.hydrated).some((choice) => choice.operation === 'issue')
        ).toBe(true)
    })
    it('hands off each corporation, resets the second round, and starts the next stock round', () => {
        const table = twoMajors()
        const first = operate(table, 'IC', true)
        expect(first.processedActions.map((action) => action.type)).toEqual([
            'FinishOperatingTurn',
            'StartOperatingTurn'
        ])
        expect(table.state.machineState).toBe('LayingTrack')
        expect(nextOperatingCompany(table.state)).toBe('NYC')
        expect(table.state.activePlayerIds).toEqual([
            controllingOwner(table.state, 'NYC')?.playerId
        ])
        expect(table.state.trainPurchaseStep).toBeUndefined()
        expect(table.state.trackStep).toEqual({ companyId: 'NYC', lays: [], completed: false })
        expect(table.state.routeStep).toBeUndefined()
        expect(table.state.earningsDistribution).toBeUndefined()

        const second = operate(table, 'NYC', true)
        expect(second.processedActions.map((action) => action.type)).toEqual([
            'FinishOperatingTurn',
            'StartOperatingRound'
        ])
        expect(second.processedActions[1].source).toBe(ActionSource.System)
        expect(table.state.machineState).toBe('AssigningSteamboat')
        expect(table.state.operatingSet).toMatchObject({
            roundNumber: 2,
            completedCompanyIds: [],
            companyOrder: ['MS', 'BIG4', 'NYC', 'IC']
        })
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(30)
        expect(Market1846.companySpace(table.state.stockMarket, 'NYC').price).toBe(90)
        expect(() => table.act('StartOperatingRound')).toThrow()
        table.act('AssignSteamboat')
        table.act('FinishTrack', { companyId: 'MS' })
        table.act('FinishTrack', { companyId: 'BIG4' })
        operate(table, 'NYC')
        operate(table, 'IC')
        expect(table.state.machineState).toBe('StockRound')
        expect(table.state.operatingSet?.completedCompanyIds).toEqual(['MS', 'BIG4', 'NYC', 'IC'])
        expect(table.state.activePlayerIds).toEqual([table.state.priorityDealPlayerId])
        expect(
            table.actions.filter((action) => action.type === 'StartOperatingRound')
        ).toHaveLength(2)
        expect(table.state.stockRound.number).toBe(2)
        expect(() =>
            table.act('FinishOperatingTurn', { companyId: 'IC', playerId: 'p1' })
        ).toThrow()

        expect(table.state.operatingSet?.completed).toBe(true)
        expect(table.state.stockRound).toMatchObject({
            completed: false,
            passedPlayerIds: [],
            sales: [],
            companyPurchases: [],
            turn: { acted: false, bought: false, soldBeforeBuying: false, companiesSold: [] }
        })
        expect(() => table.act('StartStockRound')).toThrow()
        table.buy('IC')
        table.finishStockRound()
        expect(table.state.operatingSet).toMatchObject({
            number: 2,
            roundNumber: 1,
            roundCount: 2,
            completed: false,
            companyOrder: ['MS', 'BIG4', 'NYC', 'IC']
        })
        expect(table.state.trackStep?.companyId).toBe('MS')

        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it('pays private income once each round and keeps a skipped Steamboat assignment', () => {
        const table = stockGame()
        for (let i = 0; i < 3; i++) table.act('FinishStockTurn')
        table.act('AssignSteamboat', { assignment: { companyId: 'MS', locationId: 'D14' } })
        table.act('FinishTrack', { companyId: 'MS' })
        const before = table.state.players.map(({ playerId }) =>
            finiteCashOwnedBy(table.state, { kind: 'player', playerId })
        )
        table.act('FinishTrack', { companyId: 'BIG4' })
        expect(table.state.machineState).toBe('AssigningSteamboat')
        for (const [index, { playerId }] of table.state.players.entries()) {
            const income = table.state.companies
                .filter(
                    (company) =>
                        company.kind === 'private' &&
                        !company.closed &&
                        table.state.certificates.some(
                            (certificate) =>
                                certificate.companyId === company.id &&
                                certificate.owner.kind === 'player' &&
                                certificate.owner.playerId === playerId
                        )
                )
                .reduce((sum, company) => sum + (company.privateRevenue ?? 0), 0)
            expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId })).toBe(
                before[index] + income
            )
        }
        table.act('AssignSteamboat')
        expect(table.state.steamboat).toEqual({ companyId: 'MS', locationId: 'D14' })
        expect(table.state.trackStep).toMatchObject({ companyId: 'MS', lays: [] })
        table.act('FinishTrack', { companyId: 'MS' })
        table.act('FinishTrack', { companyId: 'BIG4' })
        expect(table.state.machineState).toBe('StockRound')
    })
    it('continues to the next corporation after a zero-price closure', () => {
        const table = twoMajors()
        const space = Market1846.spaces.find((space) => space.price === 10)
        assertExists(space)
        placeStockMarker(table.state.stockMarket, 'IC', space.id)
        const result = table.act('FinishTrack', { companyId: 'IC' })
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'FinishTrack',
            'FinishStations',
            'RunTrains',
            'DistributeEarnings',
            'CloseCorporation',
            'StartOperatingTurn'
        ])
        expect(table.state.companies.find((company) => company.id === 'IC')?.closed).toBe(true)
        expect(table.state.operatingSet?.completedCompanyIds).toContain('IC')
        expect(nextOperatingCompany(table.state)).toBe('NYC')
        expect(table.state.machineState).toBe('LayingTrack')
    })
    it('removes a train when its railroad closes in OR2 and restores it on Undo', () => {
        const table = stockGame()
        table.launch('GT', 40)
        for (let i = 0; i < 2; i++) table.finishTurn()
        table.buy('GT')
        for (let i = 0; i < 2; i++) table.finishTurn()
        const sale = table
            .choices()
            .sells.find(
                (choice) => choice.sales[0].companyId === 'GT' && choice.sales[0].shares === 1
            )
        assertExists(sale)
        table.act('SellShares', sale)
        table.finishStockRound()
        table.act('FinishTrack', { companyId: 'MS' })
        table.act('FinishTrack', { companyId: 'BIG4' })
        operate(table, 'GT', true)
        const train = trainsOwnedBy(table.state, { kind: 'company', companyId: 'GT' })[0]
        assertExists(train)
        const otherTrains = table.state.trainInventory.trains.filter(
            (entry) => entry.id !== train.id
        )
        table.act('AssignSteamboat')
        table.act('FinishTrack', { companyId: 'MS' })
        table.act('FinishTrack', { companyId: 'BIG4' })
        const before = structuredClone(table.state)
        const result = table.act('FinishTrack', { companyId: 'GT' })
        expect(table.state.machineState).toBe('StockRound')
        expect(table.state.stockRound.number).toBe(2)
        expect(table.state.companies.find((company) => company.id === 'GT')?.closed).toBe(true)
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'GT' })).toEqual([])
        expect(table.state.trainInventory.trains.find((entry) => entry.id === train.id)).toEqual({
            id: train.id,
            definitionId: '2',
            status: 'removed'
        })
        expect(table.state.trainInventory.trains.filter((entry) => entry.id !== train.id)).toEqual(
            otherTrains
        )
        expect(
            result.processedActions.find((action) => action.type === 'CloseCorporation')?.metadata
        ).toMatchObject({ removedTrainIds: [train.id] })
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })

    it('keeps passing stock rounds and independent-only operating sets in a bounded player-driven loop', () => {
        const table = stockGame()
        const priority = table.state.priorityDealPlayerId
        for (let setNumber = 1; setNumber <= 3; setNumber++) {
            expect(table.state.machineState).toBe('StockRound')
            expect(table.state.stockRound.number).toBe(setNumber)
            expect(table.state.activePlayerIds).toEqual([priority])
            table.finishStockRound()
            expect(table.state.operatingSet?.number).toBe(setNumber)
            for (let roundNumber = 1; roundNumber <= 2; roundNumber++) {
                if (table.state.machineState === 'AssigningSteamboat') table.act('AssignSteamboat')
                expect(table.state.trackStep?.companyId).toBe('MS')
                expect(table.state.operatingSet?.roundNumber).toBe(roundNumber)
                table.act('FinishTrack', { companyId: 'MS' })
                table.act('FinishTrack', { companyId: 'BIG4' })
            }
        }
        expect(table.state.stockRound.number).toBe(4)
        expect(table.actions.filter((action) => action.type === 'StartStockRound')).toHaveLength(3)
        expect(
            table.actions.filter((action) => action.type === 'StartOperatingRound')
        ).toHaveLength(6)
    })
})
