import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    finiteCashOwnedBy,
    placeStockMarker,
    sharesOwned,
    trainsOwnedBy
} from '@tabletop/18xx'
import { emergencyBuyingGame as buyingGame } from './testSupport.js'
import { emergencyTrainChoices } from './emergencyTrain.js'

function phaseII(table: ReturnType<typeof buyingGame>) {
    for (const train of table.state.trainInventory.trains)
        if (train.status === 'depot' && train.definitionId === '2') train.status = 'removed'
}
function choice(table: ReturnType<typeof buyingGame>, definitionId = '2') {
    const choice = emergencyTrainChoices(table.hydrated).find(
        (c) => c.definitionId === definitionId
    )
    assertExists(choice)
    return choice
}
const treasury = { kind: 'company' as const, companyId: 'IC' }

describe('1846 emergency depot purchases without personal stock sales', () => {
    it('issues only enough stock, sells one price below the shifted marker, and replays and undoes', () => {
        const table = buyingGame()
        const plan = choice(table)
        expect(plan).toMatchObject({ issuedShares: 1, proceeds: 80, contribution: 0, price: 80 })
        const before = structuredClone(table.state)
        const result = table.act('EmergencyBuyTrain', plan)
        expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(90)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(10)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(1)
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(1)
        expect(result.processedActions[0].metadata).toMatchObject({
            certificateIds: [expect.any(String)],
            payments: [
                { from: { kind: 'bank' }, to: treasury, amount: 80 },
                { from: treasury, to: { kind: 'bank' }, amount: 80 }
            ],
            stockMove: { companyId: 'IC' }
        })
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
        table.act('FinishOperatingTurn', { companyId: 'IC' })
    })
    it('uses all issuable shares before only the needed president cash', () => {
        const table = buyingGame(0, 40)
        const plan = choice(table)
        expect(plan).toMatchObject({ issuedShares: 2, proceeds: 20, contribution: 60 })
        const owner = { kind: 'player' as const, playerId: table.state.activePlayerIds[0] }
        const cash = finiteCashOwnedBy(table.state, owner)
        table.act('EmergencyBuyTrain', plan)
        expect(finiteCashOwnedBy(table.state, owner)).toBe(cash - 60)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(0)
        expect(companyMarketSpace(table.state.stockMarket, 'IC').price).toBe(20)
    })
    it('cannot issue below $20; proceeds can be $10 a share', () => {
        expect(choice(buyingGame(0, 30))).toMatchObject({
            issuedShares: 1,
            proceeds: 10,
            contribution: 70
        })
        expect(choice(buyingGame(0, 20))).toMatchObject({
            issuedShares: 0,
            proceeds: 0,
            contribution: 80
        })
    })
    it('deducts market shares from the issuance limit', () => {
        const table = buyingGame(0, 40)
        const cert = table.state.certificates.find(
            (c) => !c.retired && c.companyId === 'IC' && c.owner.kind === 'company'
        )
        assertExists(cert)
        if (cert.retired) throw new Error('Expected live certificate')
        cert.owner = { kind: 'bank' }
        cert.poolId = 'open-market'
        expect(choice(table)).toMatchObject({ issuedShares: 1, proceeds: 20, contribution: 60 })
    })
    it('allows issuance for the dearer variant but forbids president cash if a cheaper train is affordable', () => {
        const table = buyingGame(160, 20)
        phaseII(table)
        expect(emergencyTrainChoices(table.hydrated)).toEqual([])
        const space = table.state.stockMarket.spaces.find((s) => s.price === 40)
        assertExists(space)
        placeStockMarker(table.state.stockMarket, 'IC', space.id)
        expect(choice(table, '4')).toMatchObject({ issuedShares: 1, proceeds: 20, contribution: 0 })
        expect(emergencyTrainChoices(table.hydrated).some((c) => c.definitionId === '3/5')).toBe(
            false
        )
    })
    it('also forbids president cash if issuing stock can cover the cheaper variant', () => {
        const table = buyingGame(140, 40)
        phaseII(table)
        expect(emergencyTrainChoices(table.hydrated)).toMatchObject([
            { definitionId: '3/5', issuedShares: 1, proceeds: 20, contribution: 0 }
        ])
    })
    it('permits either variant once a president contribution is necessary and advances phase', () => {
        const table = buyingGame(0, 20)
        phaseII(table)
        expect(
            emergencyTrainChoices(table.hydrated)
                .map((c) => c.definitionId)
                .sort()
        ).toEqual(['3/5', '4'])
        const result = table.act('EmergencyBuyTrain', choice(table, '4'))
        expect(table.state.phaseId).toBe('II')
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(result.processedActions.map((a) => a.type)).toContain('AdvancePhase')
    })
    it('does not mutate anything or waive the obligation when personal stock sales are needed', () => {
        const table = buyingGame(0, 20)
        const balance = table.state.cash.find(
            (c) => c.owner.kind === 'player' && c.owner.playerId === table.state.activePlayerIds[0]
        )
        assertExists(balance)
        balance.amount = 79
        const before = structuredClone(table.state)
        expect(emergencyTrainChoices(table.hydrated)).toEqual([])
        expect(() => table.act('FinishOperatingTurn', { companyId: 'IC' })).toThrow()
        expect(table.state).toEqual(before)
    })
    it('rejects forged prices, quantities, contributors, actors, exchange trains, and repeated purchases', () => {
        const table = buyingGame()
        const plan = choice(table)
        for (const fields of [
            { price: 1 },
            { issuedShares: 2 },
            { proceeds: 99 },
            { contribution: 1 },
            { companyId: 'MS' },
            { playerId: 'p2' },
            { source: ActionSource.System },
            { exchangeTrainId: 'MS:2' }
        ])
            expect(() => table.act('EmergencyBuyTrain', { ...plan, ...fields })).toThrow()
        table.act('EmergencyBuyTrain', plan)
        expect(emergencyTrainChoices(table.hydrated)).toEqual([])
        expect(() => table.act('EmergencyBuyTrain', plan)).toThrow()
    })
})
