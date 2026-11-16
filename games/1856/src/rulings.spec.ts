import { describe, expect, it } from 'vitest'
import {
    TrackConstruction,
    crisisSales,
    finiteCashOwnedBy,
    getCompany,
    homeStationId,
    type CompanyClosure
} from '@tabletop/18xx'
import { buy, edit, finishStockRound, opened, setCash, start, toBuyingTrains } from '../test/kit.js'
import { HamiltonLocationId } from './map.js'
import { CashCrisisRules1856, TrainRules1856, ZeroPriceClosure1856 } from './operating.js'
import { Market1856 } from './stockMarket.js'
import { TrackRules1856 } from './track.js'

const gt = { kind: 'company' as const, companyId: 'GT' }

/** GT started with four shares held by players, its first operating turn under way. */
function operatingGt() {
    const game = opened(4)
    start(game, 'GT', 100)
    buy(game, 'GT', 100, 2)
    finishStockRound(game)
    return game
}

function gtPresident(game: ReturnType<typeof opened>) {
    const president = getCompany(game.state, 'GT').president
    if (president?.kind !== 'player') throw new Error('GT has a player president')
    return president
}

describe('1856 forced train purchase (Purchase Train(s); designer)', () => {
    it('allows no further train once the president has helped pay for one', () => {
        const game = operatingGt()
        edit(game, (state) => setCash(state, gt, 2000))
        toBuyingTrains(game)
        expect(game.valid()).toContain('BuyTrain')
        const step = game.state.trainPurchaseStep
        if (!step) throw new Error('GT is buying trains')
        const two = game.state.trainInventory.trains.find(
            (train) => train.status === 'depot' && train.definitionId === '2'
        )
        if (!two) throw new Error('A 2-train is for sale')
        edit(game, (state) => {
            state.trainPurchaseStep = { ...step, purchasedTrainIds: [two.id], funded: true }
        })
        expect(game.valid()).not.toContain('BuyTrain')
        expect(TrainRules1856.purchaseLimit(game.hydrated, 'GT')).toBe(1)
    })

    it('takes from a president selling the company into Closed what they hold toward the train', () => {
        const game = operatingGt()
        const president = gtPresident(game)
        const train = game.state.trainInventory.trains.find((entry) => entry.status === 'depot')
        if (!train) throw new Error('A train is for sale')
        toBuyingTrains(game)
        edit(game, (state) => {
            setCash(state, gt, 30)
            setCash(state, president, 500)
            state.machineState = 'FundingTrain'
            state.trainFunding = {
                purchase: {
                    companyId: 'GT',
                    trainId: train.id,
                    definitionId: train.definitionId,
                    price: 100
                },
                playerId: president.playerId,
                contributors: [president],
                sales: []
            }
        })
        const state = game.hydrated
        const closure: CompanyClosure = ZeroPriceClosure1856.closure.close(state, 'GT')
        expect(finiteCashOwnedBy(state, president)).toBe(430)
        expect(closure.payments).toContainEqual({
            from: president,
            to: { kind: 'bank' },
            amount: 70
        })
    })
})

describe('1856 forced loan redemption (Redeem Government Loans; designer)', () => {
    it('leaves the loans a bankrupt president could not redeem on the company', () => {
        const game = operatingGt()
        const president = gtPresident(game)
        edit(game, (state) => {
            getCompany(state, 'GT').loans = 6
            setCash(state, gt, 1000)
            state.certificates = state.certificates.filter(
                (certificate) =>
                    certificate.companyId === 'GT' ||
                    certificate.owner.kind !== 'player' ||
                    certificate.owner.playerId !== president.playerId
            )
        })
        toBuyingTrains(game)
        edit(game, (state) => {
            setCash(state, gt, 50)
            setCash(state, president, 25)
        })
        if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId: 'GT' })
        const redeemed = game.actions.findLast((action) => action.type === 'RedeemExcessLoans')
        expect(redeemed?.metadata).toMatchObject({ loans: 2, unpaid: 125 })
        expect(game.valid(president.playerId)).toContain('GoBankrupt')
        game.act('GoBankrupt', {}, president.playerId)
        // $75 raised redeems no loan: both stay, and the $75 stays in the treasury.
        expect(getCompany(game.state, 'GT').loans).toBe(6)
        expect(finiteCashOwnedBy(game.state, gt)).toBe(75)
        expect(game.state.machineState).toBe('GameOver')
    })
})

describe('1856 private sales between players (Private Companies)', () => {
    it('lets a player buy another’s private in the initial stock round', () => {
        const game = opened(4)
        expect(game.state.stockRound.number).toBe(1)
        expect(game.valid()).toContain('OfferPrivatePurchase')
    })
})

describe('1856 THB home in a bare Hamilton (Place station markers; designer)', () => {
    it('places the THB in a Hamilton city at once, the first tile’s layer choosing where it ends', () => {
        const game = opened(4)
        start(game, 'THB', 100)
        finishStockRound(game)
        expect(game.actions.some((action) => action.type === 'ChooseHomeStation')).toBe(false)
        const home = game.state.stations.find((station) => station.id === homeStationId('THB'))
        expect(home).toMatchObject({
            status: 'placed',
            position: { locationId: HamiltonLocationId, nodeId: 'city-0' }
        })
        // Hamilton's first tile, #59, is green.
        edit(game, (state) => {
            state.phaseId = '3'
        })
        const lays = new TrackConstruction(game.hydrated, TrackRules1856).choices(
            HamiltonLocationId
        )
        const cities = new Set(
            lays.map((lay) => {
                const station = new TrackConstruction(game.hydrated, TrackRules1856)
                    .stationsAfter(lay)
                    .stations.find((entry) => entry.id === homeStationId('THB'))
                return station?.status === 'placed' ? station.position.nodeId : undefined
            })
        )
        expect(cities).toEqual(new Set(['city-0', 'city-1']))
    })
})

describe('1856 operating order after forced sales (Operating Rounds)', () => {
    it('puts the companies still to operate in their new price order after a sale to pay interest', () => {
        const game = opened(4)
        start(game, 'GT', 100)
        const presidentId = gtPresident(game).playerId
        start(game, 'CPR', 90)
        start(game, 'THB', 80)
        finishStockRound(game)
        expect(game.state.operatingSet?.companyOrder).toEqual(['GT', 'CPR', 'THB'])
        edit(game, (state) => {
            getCompany(state, 'GT').loans = 5
            setCash(state, gt, 0)
            setCash(state, { kind: 'player', playerId: presidentId }, 0)
            const cpr = state.certificates.filter(
                (certificate) =>
                    certificate.companyId === 'CPR' &&
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.owner.kind === 'bank'
            )
            for (const certificate of cpr.slice(0, 2)) {
                certificate.owner = { kind: 'player', playerId: presidentId }
                delete certificate.poolId
            }
        })
        toBuyingTrains(game, ['RaisingCash'])
        expect(game.state.machineState).toBe('RaisingCash')
        const [sale] = crisisSales(game.hydrated, CashCrisisRules1856, presidentId).filter(
            (entry) => entry.sale.companyId === 'CPR'
        )
        if (!sale) throw new Error('GT’s president may sell a CPR share')
        game.act(
            'SellSharesToPay',
            { sale: sale.sale, expectedProceeds: sale.proceeds },
            presidentId
        )
        const cprPrice = Market1856.companySpace(game.state.stockMarket, 'CPR').price
        expect(cprPrice).toBeLessThanOrEqual(80)
        expect(game.state.operatingSet?.companyOrder).toEqual(['GT', 'THB', 'CPR'])
    })
})

describe('1856 the bank breaking (Ending the Game; designer)', () => {
    it('sets up a bank broken only by a payout it cannot make in full', () => {
        expect(opened(4).state.bank.breaksOnShortfall).toBe(true)
    })
})
