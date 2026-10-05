import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    companyMarketSpace,
    purchaseChoices,
    trainsOwnedBy
} from '@tabletop/18xx'
import { stockGame } from './testSupport.js'
import { TransferRules1846 } from './acquisitions.js'
import { TrainRules1846 } from './trains.js'
import { emergencyTrainChoices } from './emergencyTrain.js'

function tradingGame(sharedPresident = false) {
    const table = stockGame()
    table.launch('IC', 100)
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    const seller = getCompany(table.state, 'NYC')
    seller.started = true
    seller.floated = true
    placeStockMarker(
        table.state.stockMarket,
        'NYC',
        companyMarketSpace(table.state.stockMarket, 'IC').id
    )
    seller.president = {
        kind: 'player',
        playerId: sharedPresident ? table.state.activePlayerIds[0] : 'p2'
    }
    const train = table.state.trainInventory.trains.find(
        (t) => t.status === 'depot' && t.definitionId === '2'
    )
    assertExists(train)
    table.state.trainInventory.trains = table.state.trainInventory.trains.map((t) =>
        t.id === train.id
            ? { ...t, status: 'owned', owner: { kind: 'company', companyId: 'NYC' } }
            : t
    )
    return {
        table,
        request: {
            companyId: 'IC',
            asset: { kind: 'train' as const, trainId: train.id },
            seller: { kind: 'company' as const, companyId: 'NYC' },
            price: 100
        }
    }
}
function begin(table: ReturnType<typeof stockGame>) {
    table.act('CorporateFinance', { companyId: 'IC', operation: 'pass', shares: 0, amount: 0 })
    table.act('FinishTrack', { companyId: 'IC' })
}

describe('1846 intercorporation train purchases', () => {
    it('requires the train-buying step, accepts above-list negotiated prices, and resumes after seller consent', () => {
        const { table, request } = tradingGame()
        expect(() => table.act('OfferPurchase', request)).toThrow()
        begin(table)
        expect(
            purchaseChoices(
                table.hydrated,
                table.state.activePlayerIds[0],
                TransferRules1846,
                TrainRules1846
            )
        ).toContainEqual({ request: { ...request, price: 1 }, minimum: 1 })
        const before = structuredClone(table.state)
        const buyer = table.state.activePlayerIds[0]
        const cash = finiteCashOwnedBy(table.state, request.seller)
        const actions = [...table.act('OfferPurchase', request).processedActions]
        expect(table.state.activePlayerIds).toEqual(['p2'])
        expect(emergencyTrainChoices(table.hydrated)).toEqual([])
        expect(() =>
            table.act('FinishOperatingTurn', { companyId: 'IC', playerId: buyer })
        ).toThrow()
        assertExists(table.state.purchaseOffer)
        expect(() =>
            table.act('RespondToPurchaseOffer', {
                offerId: table.state.purchaseOffer?.id,
                accept: true,
                playerId: buyer
            })
        ).toThrow()
        actions.push(
            ...table.act('RespondToPurchaseOffer', {
                offerId: table.state.purchaseOffer.id,
                accept: true
            }).processedActions
        )
        expect(table.state.purchaseOffer).toBeUndefined()
        expect(table.state.activePlayerIds).toEqual([buyer])
        expect(
            trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' }).map((t) => t.id)
        ).toEqual([request.asset.trainId])
        expect(trainsOwnedBy(table.state, request.seller)).toEqual([])
        expect(finiteCashOwnedBy(table.state, request.seller)).toBe(cash + 100)
        expect(table.state.phaseId).toBe('I')
        expect(table.state.trainPurchaseStep?.purchasedTrainIds).toEqual([])
        let replay = before
        for (const action of actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('settles shared-president purchases immediately and makes the train obligation satisfied', () => {
        const { table, request } = tradingGame(true)
        begin(table)
        table.act('OfferPurchase', { ...request, price: 1 })
        expect(table.state.purchaseOffer).toBeUndefined()
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toHaveLength(1)
        table.act('FinishOperatingTurn', { companyId: 'IC' })
    })
    it('leaves money and trains alone after rejection and allows another offer', () => {
        const { table, request } = tradingGame()
        begin(table)
        const cash = structuredClone(table.state.cash)
        const trains = structuredClone(table.state.trainInventory)
        table.act('OfferPurchase', request)
        assertExists(table.state.purchaseOffer)
        table.act('RespondToPurchaseOffer', {
            offerId: table.state.purchaseOffer.id,
            accept: false
        })
        expect(table.state.cash).toEqual(cash)
        expect(table.state.trainInventory).toEqual(trains)
        table.act('OfferPurchase', request)
        expect(table.state.purchaseOffer).toBeDefined()
    })
    it('rejects independent trains, owner funding, wrong sellers, invalid prices and phased-out trains', () => {
        const { table, request } = tradingGame()
        begin(table)
        for (const fields of [
            {
                asset: { kind: 'train', trainId: 'MS:2' },
                seller: { kind: 'company', companyId: 'MS' }
            },
            { price: 301 },
            { price: 0 },
            { price: 1.5 },
            { source: ActionSource.System },
            { seller: { kind: 'company', companyId: 'IC' } }
        ])
            expect(() => table.act('OfferPurchase', { ...request, ...fields })).toThrow()
        const train = table.state.trainInventory.trains.find((t) => t.id === request.asset.trainId)
        assertExists(train)
        if (train.status !== 'owned') throw new Error('Expected owned train')
        train.rustsAfterOperation = true
        expect(() => table.act('OfferPurchase', request)).toThrow()
    })
    it('enforces the four-train limit before buying from another corporation', () => {
        const { table, request } = tradingGame()
        begin(table)
        for (let i = 0; i < 4; i++)
            table.state.trainInventory.trains.push({
                id: `owned:${i}`,
                definitionId: '2',
                status: 'owned',
                owner: { kind: 'company', companyId: 'IC' }
            })
        expect(() => table.act('OfferPurchase', request)).toThrow()
    })
})
