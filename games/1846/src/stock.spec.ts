import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { finiteCashOwnedBy, getCompany, placeStockMarker, sharesOwned } from '@tabletop/18xx'
import { stockGame } from './testSupport.js'
import { StockRules1846, Market1846 } from './stock.js'

describe('1846 first stock round', () => {
    it('launches immediately, pays incremental capital and the IC bonus, and places its home', () => {
        const table = stockGame()
        const playerId = table.state.activePlayerIds[0]
        const cash = finiteCashOwnedBy(table.state, { kind: 'player', playerId })
        const result = table.launch()
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'StartCompany',
            'FloatCompany',
            'FinishStockTurn'
        ])
        expect(result.processedActions[2].source).toBe('system')
        expect(table.state.activePlayerIds).not.toContain(playerId)
        expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId })).toBe(cash - 80)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(120)
        expect(getCompany(table.state, 'IC')).toMatchObject({
            started: true,
            floated: true,
            funded: true
        })
        expect(
            table.state.stations.find(
                (station) => station.companyId === 'IC' && station.status === 'placed'
            )
        ).toMatchObject({ position: { locationId: 'K3' } })
    })
    it('pays treasury purchases to the corporation and forbids non-president sales before operation', () => {
        const table = stockGame()
        table.launch()
        table.buy('IC')
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(160)
        table.finishTurn()
        table.finishTurn()
        table.finishTurn()
        expect(
            table.choices().sells.filter((choice) => choice.sales[0].companyId === 'IC')
        ).toEqual([])
    })
    it('sells a president’s block at its original price, moves once, and prohibits rebuying', () => {
        const table = stockGame()
        const president = table.state.activePlayerIds[0]
        table.launch()
        table.finishTurn()
        table.finishTurn()
        table.buy('IC')
        table.finishTurn()
        table.finishTurn()
        table.buy('IC')
        table.finishTurn()
        table.finishTurn()
        const before = finiteCashOwnedBy(table.state, { kind: 'player', playerId: president })
        const sale = table
            .choices()
            .sells.find(
                (choice) => choice.sales[0].companyId === 'IC' && choice.sales[0].shares === 2
            )
        assertExists(sale, 'President can sell the whole block')
        expect(sale.expectedProceeds).toBe(80)
        table.act('SellShares', sale)
        expect(table.choices().sells.some((choice) => choice.sales[0].companyId === 'IC')).toBe(
            false
        )
        expect(() =>
            table.act('SellShares', {
                ...sale,
                sales: [{ companyId: 'IC', shares: 1 }],
                expectedProceeds: 30
            })
        ).toThrow()
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(30)
        expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId: president })).toBe(
            before + 80
        )
        expect(table.choices().buys.some((choice) => choice.companyId === 'IC')).toBe(false)
        table.finishTurn()
        const treasury = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
        table.buy('IC', 'bank')
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(treasury)
    })
    it('completes on consecutive passes, preserves priority after no trades, and rejects further actions', () => {
        const table = stockGame()
        const priority = table.state.priorityDealPlayerId
        table.finishTurn()
        table.finishTurn()
        table.finishTurn()
        expect(table.state.machineState).toBe('LayingTrack')
        expect(table.state.priorityDealPlayerId).toBe(priority)
        expect(table.state.trackStep?.companyId).toBe('MS')
        expect(() => table.finishTurn()).toThrow()
    })
    it('passes priority clockwise after the last trade and drops stock with market shares once', () => {
        const table = stockGame()
        table.launch()
        table.finishTurn()
        table.finishTurn()
        table.buy('IC')
        table.finishTurn()
        table.finishTurn()
        const sale = table.choices().sells.find((choice) => choice.sales[0].companyId === 'IC')
        assertExists(sale, 'Sale required')
        table.act('SellShares', sale)
        table.finishTurn()
        const priority = table.state.activePlayerIds[0]
        table.finishTurn()
        table.finishTurn()
        table.finishTurn()
        expect(table.state.priorityDealPlayerId).toBe(priority)
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(20)
    })
    it('transfers presidency on a larger holding, keeping the incumbent on ties', () => {
        const table = stockGame()
        const first = table.state.activePlayerIds[0]
        table.launch()
        const second = table.state.activePlayerIds[0]
        for (let i = 0; i < 3; i++) {
            table.buy('IC')
            if (i < 2) {
                expect(getCompany(table.state, 'IC').president).toEqual({
                    kind: 'player',
                    playerId: first
                })
                table.finishTurn()
                table.finishTurn()
            }
        }
        expect(getCompany(table.state, 'IC').president).toEqual({
            kind: 'player',
            playerId: second
        })
        expect(sharesOwned(table.state, 'IC', { kind: 'player', playerId: first })).toBe(2)
    })
    it('replays and reverses the stock round including automatic flotation and completion', () => {
        const table = stockGame()
        table.launch()
        table.finishTurn()
        table.finishTurn()
        table.finishTurn()
        let replay = table.initialState
        for (const action of table.actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of table.actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(table.initialState)
    })
    it('rejects stale prices, wrong actors, a second purchase and sales after buying', () => {
        const table = stockGame()
        const launch = table.choices().starts[0]
        expect(() =>
            table.act('StartCompany', { ...launch, expectedPrice: launch.expectedPrice + 1 })
        ).toThrow()
        expect(() => table.act('StartCompany', { ...launch, playerId: 'not-the-player' })).toThrow()
        const launcher = table.state.activePlayerIds[0]
        table.launch()
        const secondStart = table.choices().starts.find((choice) => choice.companyId === 'GT')
        assertExists(secondStart)
        expect(() => table.act('StartCompany', { ...secondStart, playerId: launcher })).toThrow()
        table.finishTurn()
        table.finishTurn()
        const purchase = table.buy('IC')
        expect(purchase.processedActions.map((action) => action.type)).toEqual([
            'BuyShares',
            'FinishStockTurn'
        ])
    })
    it('sells a complete president certificate before operation and transfers control once', () => {
        const table = stockGame()
        const seller = table.state.activePlayerIds[0]
        table.launch()
        const successor = table.state.players.find((player) => player.playerId !== seller)!.playerId
        for (const certificate of table.state.certificates
            .filter(
                (certificate) =>
                    !certificate.retired &&
                    certificate.kind === 'share' &&
                    certificate.companyId === 'IC' &&
                    !certificate.president
            )
            .slice(0, 2))
            if (!certificate.retired) certificate.owner = { kind: 'player', playerId: successor }
        table.finishTurn()
        table.finishTurn()
        const sale = table
            .choices()
            .sells.find(
                (choice) => choice.sales[0].companyId === 'IC' && choice.sales[0].shares === 2
            )
        assertExists(sale)
        expect(sale.expectedProceeds).toBe(80)
        table.act('SellShares', sale)
        expect(getCompany(table.state, 'IC').president).toEqual({
            kind: 'player',
            playerId: successor
        })
        expect(sharesOwned(table.state, 'IC', { kind: 'player', playerId: seller })).toBe(0)
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(30)
    })
    it('records round-end closure before starting operations and reverses the entire cascade', () => {
        const table = stockGame()
        table.launch()
        placeStockMarker(table.state.stockMarket, 'IC', '0:2')
        table.finishTurn()
        table.finishTurn()
        table.buy('IC')
        table.finishTurn()
        table.finishTurn()
        const sale = table.choices().sells.find((choice) => choice.sales[0].companyId === 'IC')
        assertExists(sale)
        table.act('SellShares', sale)
        table.finishTurn()
        table.finishTurn()
        table.finishTurn()
        const before = structuredClone(table.state)
        const result = table.finishTurn()
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'FinishStockTurn',
            'CompleteStockRound',
            'CloseCorporation',
            'StartOperatingSet',
            'StartOperatingRound',
            'AssignSteamboat',
            'StartOperatingTurn'
        ])
        expect(result.processedActions[2].metadata).toMatchObject({
            removedMarketSpaceId: '0:0',
            payments: [{ amount: 140 }],
            retiredCertificateIds: expect.any(Array),
            removedReservations: expect.any(Array)
        })
        expect(table.state.operatingSet?.companyOrder).not.toContain('IC')
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('closes a zero-price corporation, returns cash, removes tokens and lowers the certificate limit', () => {
        const table = stockGame()
        table.launch()
        placeStockMarker(table.state.stockMarket, 'IC', '0:1')
        table.finishTurn()
        table.finishTurn()
        table.buy('IC')
        table.finishTurn()
        table.finishTurn()
        const sale = table.choices().sells.find((choice) => choice.sales[0].companyId === 'IC')
        assertExists(sale, 'Sale must be available')
        const result = table.act('SellShares', sale)
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'SellShares',
            'CloseCorporation'
        ])
        expect(result.processedActions[1].metadata).toMatchObject({
            retiredCertificateIds: expect.any(Array),
            removedStationIds: expect.any(Array),
            payments: [
                { from: { kind: 'company', companyId: 'IC' }, to: { kind: 'bank' }, amount: 130 }
            ]
        })
        expect(getCompany(table.state, 'IC').closed).toBe(true)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(0)
        expect(
            table.state.certificates
                .filter((certificate) => certificate.companyId === 'IC')
                .every((certificate) => certificate.retired)
        ).toBe(true)
        expect(
            table.state.stations
                .filter((station) => station.companyId === 'IC')
                .every((station) => station.status === 'removed')
        ).toBe(true)
        expect(
            StockRules1846.certificateLimit(table.hydrated, {
                kind: 'player',
                playerId: table.state.activePlayerIds[0]
            })
        ).toBe(11)
    })
})
