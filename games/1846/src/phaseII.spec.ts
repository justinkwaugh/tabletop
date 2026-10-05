import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { finiteCashOwnedBy, trainsOwnedBy, type RouteRevenueStop } from '@tabletop/18xx'
import { stockGame, start, buyTrain } from './testSupport.js'
import { corporateFinanceChoices } from './corporateFinance.js'
import { TrainDepot1846, trainBuyingChoices1846 } from './trains.js'
import { RouteRules1846 } from './routes.js'

function lastPhaseITrain() {
    const table = stockGame()
    table.launch('IC', 100)
    table.finishTurn()
    table.launch('NYC', 100)
    table.finishTurn()
    for (let i = 0; i < 3; i++) table.finishTurn()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    table.act('CorporateFinance', { companyId: 'IC', operation: 'pass', shares: 0, amount: 0 })
    table.act('FinishTrack', { companyId: 'IC' })
    for (let i = 0; i < 3; i++) buyTrain(table, '2')
    table.act('FinishOperatingTurn', { companyId: 'IC' })
    const issue = corporateFinanceChoices(table.hydrated).find(
        (choice) => choice.operation === 'issue' && choice.shares === 2
    )
    assertExists(issue)
    table.act('CorporateFinance', issue)
    table.act('FinishTrack', { companyId: 'NYC' })
    buyTrain(table, '2')
    return table
}
describe('1846 phase-II train introduction', () => {
    it.each([
        ['3/5', 160],
        ['4', 180]
    ] as const)(
        'buys %s for $%i from shared supply and records the phase change',
        (definitionId, price) => {
            const table = lastPhaseITrain()
            expect(
                trainBuyingChoices1846(table.hydrated)?.offers.map((offer) => offer.definitionId)
            ).toEqual(['2'])
            const premature = TrainDepot1846.nextTrain(table.state.trainInventory, definitionId)
            assertExists(premature)
            expect(() =>
                table.act('BuyTrain', {
                    companyId: 'NYC',
                    trainId: premature.id,
                    definitionId,
                    expectedPrice: price
                })
            ).toThrow()
            buyTrain(table, '2')
            expect(table.state.phaseId).toBe('I')
            const choices = trainBuyingChoices1846(table.hydrated)?.offers
            expect(choices?.map((offer) => offer.definitionId)).toEqual(['4', '3/5'])
            expect(choices?.[0].trainId).toBe(choices?.[1].trainId)
            const cash = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })
            const privates = table.state.companies.filter((company) => company.kind === 'private')
            const before = structuredClone(table.state)
            const result = buyTrain(table, definitionId)
            expect(result.processedActions.map((action) => action.type)).toEqual([
                'BuyTrain',
                'AdvancePhase'
            ])
            expect(result.processedActions[1].source).toBe(ActionSource.System)
            expect(result.processedActions[1].metadata).toMatchObject({
                event: {
                    fromPhaseId: 'I',
                    toPhaseId: 'II',
                    definitionId,
                    rustedTrainIds: [],
                    privateEffects: []
                },
                nextState: 'BuyingTrains'
            })
            expect(table.state.phaseId).toBe('II')
            expect(table.state.phaseEvents).toHaveLength(1)
            expect(table.state.phaseChange).toBeUndefined()
            expect(table.state.machineState).toBe('BuyingTrains')
            expect(table.state.activePlayerIds).toEqual(before.activePlayerIds)
            expect(table.state.trainPurchaseStep?.companyId).toBe('NYC')
            expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })).toBe(
                cash - price
            )
            expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })).toHaveLength(
                3
            )
            expect(TrainDepot1846.remaining(table.state.trainInventory, '4')).toBe(3)
            expect(TrainDepot1846.remaining(table.state.trainInventory, '3/5')).toBe(3)
            expect(table.state.companies.filter((company) => company.kind === 'private')).toEqual(
                privates
            )
            expect(
                table.state.trainInventory.trains.filter(
                    (train) => train.definitionId === '2' && train.status === 'owned'
                )
            ).toHaveLength(7)
            expect(() => table.act('AdvancePhase', { source: ActionSource.System })).toThrow()
            let state = before
            for (const action of result.processedActions)
                state = table.engine.applyProcessedAction({ game: table.game, state, action })
            expect(state).toEqual(table.state)
            for (const action of result.processedActions.toReversed())
                state = table.engine.undoProcessedAction({ state, action })
            expect(state).toEqual(before)
            table.act('FinishOperatingTurn', { companyId: 'NYC' })
            expect(table.state.operatingSet?.roundNumber).toBe(2)
            expect(['AssigningSteamboat', 'LayingTrack']).toContain(table.state.machineState)
        }
    )
    it('offers only the affordable face and rejects its alternate price', () => {
        const table = lastPhaseITrain()
        buyTrain(table, '2')
        const cash = table.state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'NYC'
        )
        assertExists(cash)
        cash.amount = 160
        const offers = trainBuyingChoices1846(table.hydrated)?.offers
        expect(offers?.map((offer) => offer.definitionId)).toEqual(['3/5'])
        const trainId = offers?.[0].trainId
        expect(() =>
            table.act('BuyTrain', {
                companyId: 'NYC',
                trainId,
                definitionId: '4',
                expectedPrice: 160
            })
        ).toThrow()
        buyTrain(table, '3/5')
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })).toBe(0)
    })
    it.each([3, 4, 5])('creates the correct shared phase-II supply for %i players', (count) => {
        const { state } = start(count)
        expect(TrainDepot1846.remaining(state.trainInventory, '4')).toBe(count + 1)
        expect(TrainDepot1846.remaining(state.trainInventory, '3/5')).toBe(count + 1)
    })
    it('counts the best three stops including a station and only counted-stop bonuses for a 3/5', () => {
        const train = TrainDepot1846.trainDefinition('3/5')
        const stops: RouteRevenueStop[] = [10, 30, 40, 50, 60].map((amount, index) => ({
            locationId: String(index),
            nodeId: 'city',
            amount,
            bonus: index === 1 ? 40 : 0,
            companyStation: index === 0
        }))
        const select = RouteRules1846.payingStops
        assertExists(select)
        expect(select(train, stops).map((stop) => stop.locationId)).toEqual(['0', '1', '4'])
        expect(select(train, stops.slice(0, 2))).toEqual(stops.slice(0, 2))
        expect(select(TrainDepot1846.trainDefinition('4'), stops)).toEqual(stops)
        const equal = stops.map((stop) => ({ ...stop, amount: 10, bonus: 0 }))
        expect(select(train, equal).some((stop) => stop.companyStation)).toBe(true)
    })
})
