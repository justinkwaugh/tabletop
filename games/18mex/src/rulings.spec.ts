import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    TrackConstruction,
    getCompany,
    homeStationId,
    presidentOf,
    trainsOwnedBy,
    type RevenueCenter
} from '@tabletop/18xx'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { KcmoId, McarId, MirId, MnrId, NdmId } from './companies.js'
import { isCollectMail, mailContract } from './mail.js'
import { auctionLotsMex } from './opening.js'
import {
    HydratedDeclineNdmMerger,
    HydratedMergeIntoNdm,
    PhaseChangesMex,
    mergerOfferee
} from './merger.js'
import { closeMinorsMex } from './minors.js'
import {
    EndingRulesMex,
    PrivatePowerRulesMex,
    TrainRulesMex,
    TransferRulesMex
} from './operating.js'
import { RouteRulesMex } from './routes.js'
import { CompanyRulesMex, StockRulesMex, ndmUnitsValue } from './stock.js'
import { MarketMex } from './stockMarket.js'
import { CopperCanyonTileId } from './tiles.js'
import { TrackRulesMex } from './track.js'
import {
    FourDId,
    MinorTrainId,
    SixHalfPhaseId,
    ThreeHalfPhaseId,
    TrainDepotMex,
    phaseAfterPurchaseMex
} from './trains.js'
import { PhaseRulesMex } from './operating.js'

const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const holder = (state: { certificates: readonly { id: string; owner: unknown }[] }, id: string) =>
    state.certificates.find((certificate) => certificate.id === id)?.owner

/** A table past the auction, player n buying the n-th item in turn order. */
function opened(count = 4) {
    const game = kit.table(count, 7)
    for (const lot of auctionLotsMex(game.state)) {
        game.act('BuyAuctionLot', { lotId: lot.id, expectedPrice: lot.price })
        if (game.state.pendingPar)
            game.act('ParCompany', { companyId: NdmId, marketSpaceId: kit.spaceAt(70) })
    }
    return game
}

describe('the auction (3.1, Table III)', () => {
    it('offers the privates and minors in the order of their numbers', () => {
        const game = kit.table(4, 7)
        expect(game.state.openingAuction?.remainingLotIds).toEqual([
            McarId,
            'KCMO',
            'A',
            'B',
            'C',
            MirId,
            MnrId
        ])
    })
    it('lets a bidder who passed bid again after another bid (3.1.1)', () => {
        const game = kit.table(4, 7)
        const [first, second, third, fourth] = game.state.turnManager.turnOrder
        const price = auctionLotsMex(game.state).find((lot) => lot.id === KcmoId)?.price ?? 0
        for (const [index, playerId] of [first, second, third].entries())
            game.act('ReserveBid', { lotId: KcmoId, amount: price + 5 * (index + 1) }, playerId)
        game.act('BuyAuctionLot', { lotId: McarId, expectedPrice: 20 }, fourth)
        game.act('PassAuction', {}, first)
        game.act('RaiseAuctionBid', { lotId: KcmoId, amount: price + 20 }, second)
        game.act('PassAuction', {}, third)
        expect(game.state.activePlayerIds).toEqual([first])
        game.act('RaiseAuctionBid', { lotId: KcmoId, amount: price + 25 }, first)
        game.act('PassAuction', {}, second)
        game.act('PassAuction', {}, third)
        expect(holder(game.state, `${KcmoId}:charter`)).toEqual(player(first))
    })
    it('gives the MIR’s buyer a CHI share and the MNR’s the NdM presidency and its par', () => {
        const game = opened()
        const state = game.state
        expect(holder(state, 'CHI:share:1')).toEqual(holder(state, `${MirId}:charter`))
        expect(holder(state, 'NdM:president')).toEqual(holder(state, `${MnrId}:charter`))
        expect(getCompany(state, NdmId).parPrice).toBe(70)
        expect(getCompany(state, NdmId).floated).toBeFalsy()
    })
    it('starts each minor with its owner, its home station and its built-in 2-train', () => {
        const state = opened().state
        for (const minor of ['A', 'B', 'C']) {
            const company = getCompany(state, minor)
            expect(presidentOf(state, minor)).toEqual(holder(state, `${minor}:charter`))
            expect(company.floated).toBe(true)
            expect(
                state.stations.find((station) => station.id === homeStationId(minor))?.status
            ).toBe('placed')
            expect(
                trainsOwnedBy(state, { kind: 'company', companyId: minor }).map(
                    (t) => t.definitionId
                )
            ).toEqual([MinorTrainId])
        }
        expect(TrainDepotMex.remaining(state.trainInventory, '2')).toBe(6)
    })
})

describe('stock (3.2, 3.3, 5.1)', () => {
    it('keeps NdM stock off sale until phase 3½', () => {
        const game = opened()
        const share = game.state.certificates.find((entry) => entry.id === 'NdM:share:1')
        if (share?.kind !== 'share') throw new Error('No NdM share')
        expect(typeof StockRulesMex.purchaseTerms(game.state, share, player('p1'))).toBe('string')
        const later = { ...game.state, phaseId: ThreeHalfPhaseId }
        const terms = StockRulesMex.purchaseTerms(later, share, player('p1'))
        expect(typeof terms === 'string' ? terms : terms.price).toBe(70)
    })
    it('prices a 5% NdM unit at half a share, rounded down to buy and up to sell', () => {
        expect(ndmUnitsValue(1, 75, 'down')).toBe(37)
        expect(ndmUnitsValue(1, 75, 'up')).toBe(38)
        expect(ndmUnitsValue(3, 75, 'up')).toBe(113)
        expect(ndmUnitsValue(2, 75, 'down')).toBe(75)
    })
    it('counts neither 5% NdM certificates nor yellow-zone stock toward the certificate limit', () => {
        const state = opened().state
        const half = state.certificates.find((entry) => entry.id === 'NdM:half:1')
        const charter = state.certificates.find((entry) => entry.id === 'A:charter')
        if (!half || !charter) throw new Error('Missing certificates')
        expect(StockRulesMex.certificateWeight(state, half)).toBe(0)
        expect(StockRulesMex.certificateWeight(state, charter)).toBe(1)
        expect(StockRulesMex.certificateLimit(state, player('p1'))).toBe(14)
    })
    it('never lets a minor be sold', () => {
        const state = { ...opened().state }
        expect(StockRulesMex.saleTerms(state, 'A', 1, player('p3'))).toMatch(/never/)
    })
    it('starts any major but the NdM at $60–$90 par, the NdM only from phase 3½', () => {
        const state = opened().state
        const prices = (companyId: string, phaseId = state.phaseId) =>
            CompanyRulesMex.startMarketSpaces({ ...state, phaseId }, companyId).map(
                (id) => MarketMex.space(id).price
            )
        expect(prices('CHI').sort()).toEqual([60, 70, 75, 80, 90])
        expect(prices(NdmId)).toEqual([])
        expect(prices(NdmId, ThreeHalfPhaseId)).toHaveLength(5)
    })
})

describe('trains and phases (Table I, 4.3.4)', () => {
    it('starts phase 3½ with the fifth 3-train and 6½ with the second 6-train', () => {
        const inventory = TrainDepotMex.createInventory()
        // The depot after the first `count` trains of the kind have left it.
        const sold = (definitionId: string, count: number) => {
            const gone = inventory.trains
                .filter((train) => train.definitionId === definitionId)
                .slice(0, count)
            return {
                phaseId: '3',
                trainInventory: {
                    ...inventory,
                    trains: inventory.trains.filter((train) => !gone.includes(train))
                }
            }
        }
        expect(phaseAfterPurchaseMex(sold('3', 3), '3')).toBe('3')
        expect(phaseAfterPurchaseMex(sold('3', 4), '3')).toBe(ThreeHalfPhaseId)
        expect(phaseAfterPurchaseMex({ ...sold('6', 1), phaseId: '6' }, '6')).toBe(SixHalfPhaseId)
    })
    it('gives the NdM one more train than the others from 3½, and a minor never buys', () => {
        const state = opened().state
        expect(TrainRulesMex.trainLimit({ ...state, phaseId: '4' }, 'CHI')).toBe(2)
        expect(TrainRulesMex.trainLimit({ ...state, phaseId: '4' }, NdmId)).toBe(3)
        expect(TrainRulesMex.trainLimit({ ...state, phaseId: ThreeHalfPhaseId }, NdmId)).toBe(4)
        expect(TrainRulesMex.purchaseLimit(state, 'CHI')).toBe(1)
        expect(TrainRulesMex.purchaseLimit({ ...state, phaseId: '4' }, 'CHI')).toBe('unlimited')
        expect(TrainRulesMex.purchaseLimit(state, 'A')).toBe(0)
    })
    it('makes the 4-trains obsolete at 6½, or rusts them under the hard-rust option', () => {
        const state = opened().state
        const four = { id: 'x', definitionId: '4', status: 'depot' as const }
        expect(PhaseRulesMex.rustTiming({ ...state, phaseId: SixHalfPhaseId }, four)).toBe(
            'after-operation'
        )
        const hard = { ...state, phaseId: SixHalfPhaseId, options: { hardRust: true as const } }
        expect(PhaseRulesMex.rustTiming(hard, four)).toBe('immediate')
        const minorTrain = { id: 'y', definitionId: MinorTrainId, status: 'depot' as const }
        expect(PhaseRulesMex.rustTiming({ ...state, phaseId: '4' }, minorTrain)).toBeUndefined()
    })
    it('doubles a 4D’s cities and red areas but not its towns (4.4.2.1)', () => {
        const state = opened().hydrated
        const train = TrainDepotMex.trainDefinition(FourDId)
        const stop = (locationId: string, nodeId: string): RevenueCenter => ({ locationId, nodeId })
        expect(RouteRulesMex.stopRevenue?.(state, 'CHI', stop('A6', 'offboard'), 30, train)).toBe(
            60
        )
        expect(RouteRulesMex.stopRevenue?.(state, 'CHI', stop('K6', 'port'), 10, train)).toBe(10)
        expect(RouteRulesMex.stopRevenue?.(state, 'CHI', stop('K6', 'city'), 20, train)).toBe(40)
    })
    it('sells NdM trains only at face value and never a minor’s built-in train', () => {
        const game = opened()
        const state = game.hydrated
        const minorTrain = trainsOwnedBy(state, { kind: 'company', companyId: 'A' })[0]
        expect(
            TransferRulesMex.canPurchase(state, 'CHI', { kind: 'train', trainId: minorTrain.id })
        ).toBe(false)
        const twoTrain = state.trainInventory.trains.find((t) => t.definitionId === '2')
        if (!twoTrain) throw new Error('No 2-train')
        expect(
            TransferRulesMex.priceRange(state, NdmId, { kind: 'train', trainId: twoTrain.id })
        ).toEqual({
            minimum: 100,
            maximum: 100
        })
    })
})

describe('the minors (4.2, 5.2)', () => {
    it('close at phase 3½: trade-in shares, money to the major, station and train gone', () => {
        const state = structuredClone(opened().state)
        const cashOf = (companyId: string) =>
            state.cash.find(
                (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
            )
        const aCash = cashOf('A')
        if (aCash) aCash.amount = 45
        const owner = holder(state, 'A:charter')
        const closures = closeMinorsMex(state)
        expect(closures.map((closure) => closure.minorId)).toEqual(['A', 'B', 'C'])
        expect(holder(state, 'NdM:half:1')).toEqual(owner)
        expect(cashOf(NdmId)?.amount).toBe(45)
        expect(getCompany(state, 'A').closed).toBe(true)
        expect(state.stations.find((station) => station.id === homeStationId('A'))?.status).toBe(
            'removed'
        )
        expect(state.trainInventory.trains.some((t) => t.definitionId === MinorTrainId)).toBe(false)
    })
})

describe('track (4.4.1, Table III, Table IV)', () => {
    const step = (companyId: string, lays: string[]) => ({
        companyId,
        completed: false,
        lays: lays.map((definitionId) => ({ locationId: 'X', definitionId }))
    })
    it('lets a major lay two yellow tiles or upgrade one, and a minor lay one yellow', () => {
        const state = opened().state
        const allowed = (companyId: string, lays: string[], color: string) =>
            'cost' in TrackRulesMex.allowance({ ...state, trackStep: step(companyId, lays) }, color)
        expect(allowed('CHI', [], 'green')).toBe(true)
        expect(allowed('CHI', ['18xx:8'], 'yellow')).toBe(true)
        expect(allowed('CHI', ['18xx:8'], 'green')).toBe(false)
        expect(allowed('CHI', ['18xx:8', '18xx:9'], 'yellow')).toBe(false)
        expect(allowed('CHI', ['18xx:14'], 'yellow')).toBe(false)
        expect(allowed('A', [], 'green')).toBe(false)
        expect(allowed('A', ['18xx:8'], 'yellow')).toBe(false)
        const threeYellow = { ...state, options: { threeYellowLays: true as const } }
        expect(
            'cost' in
                TrackRulesMex.allowance(
                    { ...threeYellow, trackStep: step('CHI', ['18xx:8', '18xx:9']) },
                    'yellow'
                )
        ).toBe(true)
    })
    const details = (companyId: string, locationId: string, definitionId: string) => ({
        companyId,
        locationId,
        definitionId,
        rotation: 0 as const,
        nodeMapping: {},
        placement: { pieceId: definitionId, definitionId, rotation: 0 as const },
        cost: 0,
        terrainCost: 0,
        allowanceCost: 0,
        movedStations: []
    })
    it('lays the Mexico City tile with Puebla’s half, paying Puebla’s $60', () => {
        const state = opened().state
        expect(TrackRulesMex.companionTiles?.(state, details(NdmId, 'O10', '18mex:479MC'))).toEqual(
            [{ locationId: 'P11', definitionId: '18mex:479P', rotation: 0 }]
        )
        const request = {
            companyId: NdmId,
            locationId: 'O10',
            definitionId: '18mex:479MC',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRulesMex.terrainCost?.(state, request, 0)).toBe(60)
        expect(
            TrackRulesMex.restriction(state, {
                ...request,
                locationId: 'P11',
                definitionId: '18mex:479P'
            })
        ).toMatch(/from Mexico City/)
    })
    it('lets only the KCM&O’s owner lay Copper Canyon, for $60, closing the private', () => {
        const state = opened().state
        const request = {
            companyId: 'CHI',
            locationId: 'F5',
            definitionId: CopperCanyonTileId,
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRulesMex.restriction(state, request)).toMatch(/KCM&O/)
        expect(
            PrivatePowerRulesMex.afterTrackLay?.(
                state,
                'KCMO',
                details('CHI', 'F5', CopperCanyonTileId)
            ).closedPrivateIds
        ).toEqual(['KCMO'])
        expect(
            new TrackConstruction(state, TrackRulesMex).mapState.tile('F5').placement
        ).toBeUndefined()
    })
})

describe('the mail contract (4.3.1)', () => {
    it('pays the current value of the home city', () => {
        const state = opened().hydrated
        expect(mailContract(state, NdmId)).toBe(20)
        expect(mailContract(state, 'UdY')).toBe(10)
        expect(mailContract({ ...state, phaseId: '5' }, 'UdY')).toBe(50)
        expect(mailContract({ ...state, phaseId: '5' }, 'PAC')).toBe(50)
    })
    it('pays a major once a turn, again on its later turns', () => {
        const game = kit.table(4, 1)
        playOut(game, 1, 3000)
        const paidTurns = new Map<string, number>()
        let paidThisTurn = 0
        for (const action of game.actions) {
            if (action.type === 'StartOperatingTurn') paidThisTurn = 0
            if (!isCollectMail(action)) continue
            paidThisTurn++
            expect(paidThisTurn).toBe(1)
            paidTurns.set(action.companyId, (paidTurns.get(action.companyId) ?? 0) + 1)
        }
        expect(Math.max(...paidTurns.values())).toBeGreaterThan(1)
    })
})

describe('the NdM merger (5.3)', () => {
    function mergerTable() {
        const game = opened()
        const state = structuredClone(game.state)
        kit.operated(state, NdmId, 'p4', { price: 70, shares: 0 })
        kit.operated(state, 'CHI', 'p2', { price: 80, shares: 4 })
        kit.operated(state, 'MC', 'p3', { price: 70, shares: 2 })
        state.phaseId = '5'
        const trainId = kit.giveTrain(state, 'TM', '5')
        kit.operated(state, 'TM', 'p1', { price: 60, shares: 2 })
        game.state = state
        return { game, trainId }
    }
    const base = { id: 'a', gameId: 'g', source: ActionSource.User }
    it('offers it clockwise from the left of the 5-train buyer’s president, skipping the NdM’s', () => {
        const { game, trainId } = mergerTable()
        const state = game.hydrated
        PhaseChangesMex.apply(state, {
            id: 'p',
            trainId,
            definitionId: '5',
            fromPhaseId: '4',
            toPhaseId: '5'
        })
        expect(mergerOfferee(state)).toBe('p2')
        new HydratedDeclineNdmMerger({ ...base, type: 'DeclineNdMMerger', playerId: 'p2' }).apply(
            state
        )
        expect(mergerOfferee(state)).toBe('p3')
    })
    it('exchanges the president’s certificate, pays holders half, and moves money and trains', () => {
        const { game, trainId } = mergerTable()
        const state = game.hydrated
        PhaseChangesMex.apply(state, {
            id: 'p',
            trainId,
            definitionId: '5',
            fromPhaseId: '4',
            toPhaseId: '5'
        })
        const merge = new HydratedMergeIntoNdm({
            ...base,
            type: 'MergeIntoNdM',
            playerId: 'p2',
            companyId: 'CHI'
        })
        merge.apply(state)
        expect(getCompany(state, 'CHI').closed).toBe(true)
        expect(holder(state, 'NdM:merger')).toEqual(player('p2'))
        // p2 held 40% of CHI: the president's certificate exchanged, 20% paid at half of $80.
        expect(merge.metadata?.merged?.compensation).toEqual([
            { from: { kind: 'bank' }, to: player('p2'), amount: 80 }
        ])
        expect(state.ndmMerger).toBeUndefined()
        expect(state.stations.find((s) => s.id === 'NdM:exchange:1')?.status).toBe('placed')
    })
    it('raises every certificate limit when the NdM has not floated', () => {
        const game = opened()
        const state = game.hydrated
        PhaseChangesMex.apply(state, {
            id: 'p',
            trainId: 'x',
            definitionId: '5',
            fromPhaseId: '4',
            toPhaseId: '5'
        })
        expect(state.certificateLimitRaised).toBe(true)
        expect(StockRulesMex.certificateLimit(state, player('p1'))).toBe(15)
    })
})

describe('the end (6)', () => {
    it('ends the game after the current operating round when a price reaches $200', () => {
        const state = opened().state
        const top = MarketMex.spaces.find((space) => space.price === 200)
        if (!top) throw new Error('No $200 space')
        const ending = EndingRulesMex.trigger({
            ...state,
            stockMarket: { stacks: [{ spaceId: top.id, companyIds: ['CHI'] }] },
            operatingSet: {
                number: 3,
                roundNumber: 2,
                roundCount: 2,
                companyOrder: [],
                completedCompanyIds: [],
                completed: false,
                privateIncomePaid: true
            }
        })
        expect(ending).toMatchObject({ finalOperatingSet: 3, finalOperatingRound: 2 })
    })
})
