import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource } from '@tabletop/common'
import { finiteCashOwnedBy, trainsOwnedBy, TrainPurchase } from '@tabletop/18xx'
import { stockGame, start } from './testSupport.js'
import { TrainRules1846, trainBuyingChoices1846 } from './trains.js'

function buyingGame() {
    const table = stockGame()
    table.launch('IC', 100)
    for (let i = 0; i < 4; i++) table.finishTurn()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    table.act('CorporateFinance', { companyId: 'IC', operation: 'pass', shares: 0, amount: 0 })
    table.act('FinishTrack', { companyId: 'IC' })
    return table
}
function offer(table: ReturnType<typeof stockGame>) {
    const choice = trainBuyingChoices1846(table.hydrated)?.offers[0]
    assertExists(choice)
    const { price, ...request } = choice
    return { ...request, expectedPrice: price }
}
describe('1846 first major train buying', () => {
    it('buys a real $80 train and finishes the turn with replayable ownership and cash', () => {
        const table = buyingGame()
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(trainBuyingChoices1846(table.hydrated)?.mayFinish).toBe(false)
        expect(() => table.act('FinishOperatingTurn', { companyId: 'IC' })).toThrow()
        const request = offer(table)
        const bank = finiteCashOwnedBy(table.state, { kind: 'bank' })
        table.act('BuyTrain', request)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(220)
        expect(finiteCashOwnedBy(table.state, { kind: 'bank' })).toBe(bank + 80)
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toMatchObject([
            { id: request.trainId, definitionId: '2', status: 'owned' }
        ])
        expect(table.state.phaseId).toBe('I')
        expect(trainBuyingChoices1846(table.hydrated)?.mayFinish).toBe(true)
        const finish = table.act('FinishOperatingTurn', { companyId: 'IC' })
        expect(finish.processedActions[0].metadata).toMatchObject({ number: 1, roundNumber: 1 })
        expect(table.state.machineState).toBe('AssigningSteamboat')
        expect(table.state.operatingSet?.roundNumber).toBe(2)
        expect(table.state.operatingSet?.completedCompanyIds).toEqual([])
        expect(table.state.activePlayerIds).toHaveLength(1)
        expect(table.state.trainPurchaseStep).toBeUndefined()
        expect(table.state.earningsDistribution).toBeUndefined()
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it('permits successive purchases but rejects a fifth train', () => {
        const table = buyingGame()
        const cash = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'IC'
        )
        assertExists(cash)
        cash.amount = 500
        for (let i = 0; i < 4; i++) table.act('BuyTrain', offer(table))
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toHaveLength(4)
        const next = TrainRules1846.depot.nextTrain(table.state.trainInventory, '2')
        assertExists(next)
        expect(
            new TrainPurchase(table.hydrated, TrainRules1846).evaluate({
                companyId: 'IC',
                trainId: next.id,
                definitionId: '2'
            }).reason
        ).toContain('limit')
        expect(trainBuyingChoices1846(table.hydrated)?.offers).toEqual([])
        table.act('FinishOperatingTurn', { companyId: 'IC' })
    })
    it('rejects stale trains, wrong prices, unauthorized actors and independent train purchases', () => {
        const table = buyingGame()
        const request = offer(table)
        for (const fields of [
            { expectedPrice: 1 },
            { playerId: 'p2' },
            { source: ActionSource.System },
            { trainId: 'MS:2' },
            { companyId: 'MS' }
        ])
            expect(() => table.act('BuyTrain', { ...request, ...fields })).toThrow()
        table.act('BuyTrain', request)
        expect(() => table.act('BuyTrain', request)).toThrow()
    })
    it('stops at insufficient treasury without waiving the mandatory purchase or using owner cash', () => {
        const table = buyingGame()
        const cash = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'IC'
        )
        assertExists(cash)
        cash.amount = 79
        const before = structuredClone(table.state.cash)
        expect(trainBuyingChoices1846(table.hydrated)).toMatchObject({
            offers: [],
            needsFunding: true,
            mayFinish: false
        })
        expect(() => table.act('FinishOperatingTurn', { companyId: 'IC' })).toThrow()
        expect(table.state.cash).toEqual(before)
    })
    it.each([3, 4, 5])(
        'removes setup trains for %i players without offering removed stock',
        (count) => {
            const { state } = start(count, 7)
            expect(TrainRules1846.depot.remaining(state.trainInventory, '2')).toBe(count + 2)
            expect(
                state.trainInventory.trains.filter(
                    (t) => t.status === 'removed' && t.definitionId === '2'
                )
            ).toHaveLength(5 - count)
        }
    )
})
