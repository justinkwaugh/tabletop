import { describe, expect, it } from 'vitest'
import { TrainPurchase, finiteCashOwnedBy, placeStockMarker } from '@tabletop/18xx'
import { edit, floatCompany, kit, setCash, type Table } from '../test/kit.js'
import { CompanyRulesChesapeake, StockRulesChesapeake } from './stock.js'
import { EndingRulesChesapeake, OperatingRulesChesapeake } from './operating.js'
import { EndSpaceIdChesapeake, MarketChesapeake } from './stockMarket.js'
import { OffTheRailsDieselId } from './edition.js'
import { TrainDepotChesapeake, TrainRulesChesapeake } from './trains.js'

const offTheRails = (count = 4, seed = 7): Table => kit.table(count, seed, { offTheRails: true })

/** The opening sold at face value; Cornelius Vanderbilt's buyer sets par on this market. */
function opened(count = 4): Table {
    const game = offTheRails(count)
    kit.buyAllPrivates(game)
    return game
}

describe('18Chesapeake: Off the Rails', () => {
    it('plays with a $12,000 bank and the smaller train supply (OTR sheet)', () => {
        const game = offTheRails(4)
        expect(game.state.offTheRails).toBe(true)
        expect(finiteCashOwnedBy(game.state, { kind: 'bank' })).toBe(12000 - 4 * 600)
        const remaining = (id: string) =>
            TrainDepotChesapeake.remaining(game.state.trainInventory, id)
        expect(['2', '3', '4', '5', '6'].map(remaining)).toEqual([5, 4, 3, 2, 2])
        expect(remaining('D')).toBe(0)
        expect(remaining(OffTheRailsDieselId)).toBe('unlimited')
        const standard = kit.table(4)
        expect(standard.state.offTheRails).toBeUndefined()
        expect(
            TrainDepotChesapeake.remaining(standard.state.trainInventory, OffTheRailsDieselId)
        ).toBe(0)
    })

    it('starts companies on its own market’s par spaces', () => {
        const game = offTheRails(4)
        const prices = CompanyRulesChesapeake.startMarketSpaces(game.hydrated, 'PRR').map(
            (id) => MarketChesapeake.space(id).price
        )
        expect(prices.sort((a, b) => a - b)).toEqual([67, 71, 76, 82, 90, 100])
        expect(
            CompanyRulesChesapeake.startMarketSpaces(kit.table(4).hydrated, 'PRR')
                .map((id) => MarketChesapeake.space(id).price)
                .sort((a, b) => a - b)
        ).toEqual([70, 80, 95])
    })

    it('floats companies at 50% sold', () => {
        const game = opened(4)
        floatCompany(game, 'PRR', 82)
        const sold = game.state.certificates
            .filter((entry) => entry.companyId === 'PRR' && entry.kind === 'share')
            .filter((entry) => entry.owner.kind === 'player')
            .reduce((sum, entry) => sum + (entry.kind === 'share' ? entry.shares : 0), 0)
        expect(sold).toBe(5)
    })

    it('lets a player sell after buying in the same turn (sell–buy–sell)', () => {
        const game = opened(4)
        edit(game, (state) => {
            kit.operated(state, 'LV', game.player, { price: 82 })
            state.stockRound.number = 2
        })
        const turnOrder = StockRulesChesapeake.turnOrder
        if (typeof turnOrder !== 'function') throw new Error('The turn order follows the edition')
        expect(turnOrder(game.hydrated)).toBe('sell-buy-sell')
        expect(turnOrder(kit.table(4).hydrated)).toBe('sell-buy')
    })

    it('exports no trains', () => {
        const game = opened(4)
        const state = structuredClone(game.state)
        state.operatingSet = {
            number: 1,
            roundNumber: 1,
            roundCount: 1,
            companyOrder: [],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        expect(OperatingRulesChesapeake.trainsToExport?.(state)).toEqual([])
    })

    it('sells $1,100 D-trains, $800 trading in a 4, 5 or 6', () => {
        const game = opened(4)
        floatCompany(game, 'PRR', 82)
        kit.passStockRound(game)
        edit(game, (state) => {
            for (const id of ['2', '3', '4', '5'])
                while (TrainDepotChesapeake.nextTrain(state.trainInventory, id))
                    TrainDepotChesapeake.export(state.trainInventory, id)
            state.phaseId = '6'
            const train = TrainDepotChesapeake.nextTrain(state.trainInventory, '6')
            if (!train) throw new Error('A 6-train is left')
            TrainDepotChesapeake.purchase(state.trainInventory, train.id, '6', {
                kind: 'company',
                companyId: 'PRR'
            })
            setCash(state, 'PRR', 2000)
            state.machineState = 'BuyingTrains'
            delete state.trackStep
            state.trainPurchaseStep = { companyId: 'PRR', purchasedTrainIds: [] }
        })
        const purchase = new TrainPurchase(game.hydrated, TrainRulesChesapeake)
        const offers = [
            ...purchase
                .offers()
                .flatMap((offer) => (offer.evaluation.details ? [offer.evaluation.details] : [])),
            ...purchase.exchanges()
        ]
        const diesels = offers.filter((offer) => offer.definitionId.startsWith('D'))
        expect(diesels.every((offer) => offer.definitionId === OffTheRailsDieselId)).toBe(true)
        expect(diesels.map((offer) => offer.price).sort()).toEqual([1100, 800].sort())
    })

    it('ends the game when a price reaches $300', () => {
        const game = opened(4)
        edit(game, (state) => {
            kit.operated(state, 'LV', 'p1', { price: 82 })
            placeStockMarker(state.stockMarket, 'LV', EndSpaceIdChesapeake)
        })
        expect(EndingRulesChesapeake.trigger(game.hydrated)).toMatchObject({
            reason: expect.stringContaining('$300')
        })
        expect(EndingRulesChesapeake.trigger(kit.table(4).hydrated)).toBeUndefined()
    })
})
