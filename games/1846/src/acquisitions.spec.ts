import { describe, expect, it } from 'vitest'
import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    privateOwner,
    purchaseChoices,
    trainsOwnedBy,
    RouteEvaluation,
    TrackConstruction,
    getCompany,
    StationPlacement
} from '@tabletop/18xx'
import { stockGame } from './testSupport.js'
import { TransferRules1846, canRunAcquiredTrain } from './acquisitions.js'
import { TrainDepot1846, TrainRules1846 } from './trains.js'
import { RouteRules1846 } from './routes.js'
import { TrackRules1846 } from './track.js'
import { StationRules1846 } from './stations.js'

function major() {
    const table = stockGame()
    table.launch('NYC', 100)
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    return table
}
function choice(table: ReturnType<typeof stockGame>, id: string) {
    const found = purchaseChoices(
        table.hydrated,
        table.state.activePlayerIds[0],
        TransferRules1846,
        TrainRules1846
    ).find(({ request }) =>
        request.asset.kind === 'company'
            ? request.asset.companyId === id
            : request.asset.kind === 'private' && request.asset.privateCompanyId === id
    )
    assertExists(found, `Purchase choice for ${id}`)
    return found.request
}
function purchase(table: ReturnType<typeof stockGame>, id: string, price = 1) {
    const actions = [
        ...table.act('OfferPurchase', { ...choice(table, id), price }).processedActions
    ]
    if (table.state.purchaseOffer)
        actions.push(
            ...table.act('RespondToPurchaseOffer', {
                offerId: table.state.purchaseOffer.id,
                accept: true
            }).processedActions
        )
    return actions
}
const cash = (table: ReturnType<typeof stockGame>, id: string) =>
    finiteCashOwnedBy(table.state, { kind: 'company', companyId: id })

describe('1846 corporate acquisitions', () => {
    it('clears the player Steamboat assignment on purchase and restores it through Undo', () => {
        const table = major()
        table.state.steamboat = { companyId: 'MS', locationId: 'D14' }
        const before = structuredClone(table.state)
        const train = TrainDepot1846.trainDefinition('2')
        const port = { locationId: 'D14', nodeId: 'city' }
        expect(RouteRules1846.stopBonus?.(table.hydrated, train, 'MS', port)).toBe(20)

        const actions = purchase(table, 'SC')
        expect(privateOwner(table.state, 'SC')).toEqual({ kind: 'company', companyId: 'NYC' })
        expect(table.state.steamboat).toBeUndefined()
        for (const companyId of ['MS', 'NYC'])
            expect(RouteRules1846.stopBonus?.(table.hydrated, train, companyId, port)).toBe(0)

        let replay = before
        for (const action of actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)

        table.act('AssignRevenueMarker', { privateCompanyId: 'SC' })
        purchase(table, 'MS')
        table.act('FinishTrack', { companyId: 'NYC' })
        table.act('FinishOperatingTurn', { companyId: 'NYC' })
        expect(table.state.operatingSet?.roundNumber).toBe(2)
        expect(table.state.steamboat).toBeUndefined()
    })
    it('absorbs an independent through consent, transfers assets, and replays and undoes exactly', () => {
        const table = major()
        const before = structuredClone(table.state)
        const buyerCash = cash(table, 'NYC'),
            independentCash = cash(table, 'MS')
        const available = table.state.stations.filter(
            (s) => s.companyId === 'NYC' && s.status === 'available'
        ).length
        const actions = purchase(table, 'MS', 60)
        expect(cash(table, 'NYC')).toBe(buyerCash - 60 + independentCash)
        expect(cash(table, 'MS')).toBe(0)
        expect(getCompany(table.state, 'MS').closed).toBe(true)
        expect(table.state.certificates.find((c) => c.companyId === 'MS')?.retired).toBe(true)
        const train = trainsOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })[0]
        expect(train.id).toBe('MS:2')
        expect(canRunAcquiredTrain(table.hydrated, train)).toBe(false)
        expect(new RouteEvaluation(table.hydrated, RouteRules1846).runnableTrains('NYC')).toEqual(
            []
        )
        expect(
            table.state.stations.find(
                (s) =>
                    s.companyId === 'NYC' &&
                    s.status === 'placed' &&
                    s.position.locationId === 'C15'
            )
        ).toBeDefined()
        expect(
            table.state.stations.filter((s) => s.companyId === 'NYC' && s.status === 'available')
        ).toHaveLength(available)
        expect(actions.at(-1)?.metadata).toMatchObject({
            accepted: true,
            effects: {
                assets: { trainIds: ['MS:2'], payment: { amount: independentCash } },
                stations: { placedIds: [expect.any(String)] }
            }
        })
        expect(table.state.machineState).toBe('LayingTrack')
        expect(table.state.activePlayerIds).toEqual(before.activePlayerIds)
        let replay = before
        for (const action of actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
        assertExists(table.state.operatingSet)
        table.state.operatingSet.roundNumber++
        expect(canRunAcquiredTrain(table.hydrated, train)).toBe(true)
    })
    it('suspends the buyer for an external seller and resumes unchanged after refusal', () => {
        const table = major()
        const request = choice(table, 'MS')
        const buyer = table.state.activePlayerIds[0]
        assert(request.seller.kind === 'player')
        if (request.seller.playerId === buyer) {
            const charter = table.state.certificates.find((c) => c.companyId === 'MS')
            assert(charter && !charter.retired)
            const seller = table.state.players.find((p) => p.playerId !== buyer)!.playerId
            charter.owner = { kind: 'player', playerId: seller }
            getCompany(table.state, 'MS').president = charter.owner
        }
        const before = structuredClone(table.state)
        table.act('OfferPurchase', choice(table, 'MS'))
        const offer = table.state.purchaseOffer
        assertExists(offer)
        expect(table.state.activePlayerIds).toEqual([offer.sellerPlayerId])
        expect(() => table.act('FinishTrack', { companyId: 'NYC', playerId: buyer })).toThrow()
        expect(() =>
            table.act('RespondToPurchaseOffer', {
                offerId: offer.id,
                accept: true,
                playerId: buyer
            })
        ).toThrow()
        expect(() =>
            table.act('RespondToPurchaseOffer', { offerId: 'stale', accept: true })
        ).toThrow()
        table.act('RespondToPurchaseOffer', { offerId: offer.id, accept: false })
        expect(table.state.activePlayerIds).toEqual([buyer])
        expect(table.state.cash).toEqual(before.cash)
        expect(table.state.trainInventory).toEqual(before.trainInventory)
        expect(() =>
            table.act('RespondToPurchaseOffer', { offerId: offer.id, accept: true })
        ).toThrow()
    })
    it('rejects list-price debt, zero price, unaffordable purchases and wrong sources', () => {
        const table = major(),
            request = choice(table, 'MS')
        for (const fields of [
            { price: 61 },
            { price: 140 },
            { price: 0 },
            { source: ActionSource.System }
        ])
            expect(() => table.act('OfferPurchase', { ...request, ...fields })).toThrow()
        const treasury = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'NYC'
        )
        assertExists(treasury)
        treasury.amount = 0
        expect(() => table.act('OfferPurchase', request)).toThrow()
    })
    it('requires space for the independent train and cannot buy another corporation', () => {
        const table = major(),
            request = choice(table, 'MS')
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train, index) =>
            index < 4
                ? { ...train, status: 'owned', owner: { kind: 'company', companyId: 'NYC' } }
                : train
        )
        expect(() => table.act('OfferPurchase', request)).toThrow()
        expect(
            purchaseChoices(
                table.hydrated,
                table.state.activePlayerIds[0],
                TransferRules1846,
                TrainRules1846
            ).some((c) => c.request.asset.kind === 'company')
        ).toBe(false)
        expect(() =>
            table.act('OfferPurchase', { ...request, asset: { kind: 'company', companyId: 'IC' } })
        ).toThrow()
    })
    it('removes the independent token without granting an extra when the city is already occupied by the buyer', () => {
        const table = major()
        const own = table.state.stations.find((s) => s.companyId === 'NYC' && s.status === 'placed')
        assert(own?.status === 'placed')
        own.position = { locationId: 'C15', nodeId: 'city', slot: 1 }
        const count = table.state.stations.filter((s) => s.companyId === 'NYC').length
        purchase(table, 'MS')
        expect(table.state.stations.filter((s) => s.companyId === 'NYC')).toHaveLength(count)
        expect(table.state.stations.find((s) => s.companyId === 'MS')?.status).toBe('removed')
    })
    it('transfers a private, releases its reservation, pays future income to the corporation, and prevents resale', () => {
        const table = major()
        purchase(table, 'C&WI', 60)
        expect(privateOwner(table.state, 'C&WI')).toEqual({ kind: 'company', companyId: 'NYC' })
        expect(
            new StationPlacement(table.hydrated, StationRules1846).openSlots('GT', 'D6', 'city-3')
        ).toEqual([0])
        expect(
            purchaseChoices(
                table.hydrated,
                table.state.activePlayerIds[0],
                TransferRules1846,
                TrainRules1846
            ).some(
                (c) =>
                    c.request.asset.kind === 'private' &&
                    c.request.asset.privateCompanyId === 'C&WI'
            )
        ).toBe(false)
        purchase(table, 'MS')
        table.act('FinishTrack', { companyId: 'NYC' })
        const treasury = cash(table, 'NYC')
        table.act('FinishOperatingTurn', { companyId: 'NYC' })
        expect(cash(table, 'NYC')).toBe(treasury + 10)
        expect(table.state.operatingSet?.companyOrder).not.toContain('MS')
    })
    it('allows absorption during construction and train buying without resetting completed steps', () => {
        const table = major()
        purchase(table, 'MS')
        const construction = new TrackConstruction(table.hydrated, TrackRules1846)
        const lay = construction.choices('C13')[0]
        assertExists(lay)
        table.act('LayTile', {
            companyId: 'NYC',
            locationId: lay.locationId,
            definitionId: lay.definitionId,
            rotation: lay.rotation,
            nodeMapping: lay.nodeMapping,
            expectedCost: lay.cost
        })
        table.act('FinishTrack', { companyId: 'NYC' })
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.routeStep?.result?.routes).toEqual([])
        const step = structuredClone(table.state.trackStep)
        purchase(table, 'BIG4', 40)
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.trackStep).toEqual(step)
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })).toHaveLength(2)
    })
})
