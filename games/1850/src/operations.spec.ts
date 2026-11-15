import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    EmergencyTrainFunding,
    RouteEvaluation,
    TrackConstruction,
    TrainPurchase,
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    privateTrackConstruction,
    type TrackLayDetails
} from '@tabletop/18xx'
import {
    buyTrain,
    exits,
    giveTrain,
    operated,
    prepared,
    route,
    trackAlong,
    type Table
} from '../test/kit.js'
import { edgeBonus } from './edgeTokens.js'
import { ChicagoLocationId, Map1850, WestChicagoNodeId } from './map.js'
import { MesabiRights } from './mesabi.js'
import {
    EarningsRules1850,
    PrivatePowerRules1850,
    PrivateRules1850,
    TransferRules1850
} from './operating.js'
import { RouteRules1850 } from './routes.js'
import type { State1850 } from './state.js'
import { StockRules1850, TrainFundingRules1850 } from './stock.js'
import { TileSet1850 } from './tiles.js'
import { Phases1850, TrainRules1850, revenueStages } from './trains.js'
import { TrackRules1850 } from './track.js'

function ownPrivate(state: State1850, privateId: string, companyId: string) {
    const certificate = state.certificates.find((entry) => entry.id === `${privateId}:charter`)
    assertExists(certificate, 'The private has a charter')
    certificate.owner = { kind: 'company', companyId }
}

function treasury(game: Table, companyId: string): number {
    return finiteCashOwnedBy(game.state, { kind: 'company', companyId })
}

function toCompanyTurn(game: Table, companyId: string) {
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
    expect(game.state.machineState).toBe('LayingTrack')
    expect(game.state.trackStep?.companyId).toBe(companyId)
}

function layOrdinary(game: Table, locationId: string, definitionId = '18xx:9', exit?: number) {
    const choice = new TrackConstruction(game.hydrated, TrackRules1850)
        .choices(locationId)
        .find(
            (entry) =>
                entry.definitionId === definitionId &&
                (exit === undefined || exits(entry.definitionId, entry.rotation).includes(exit))
        )
    if (!choice) throw new Error(`No ${definitionId} in ${locationId}`)
    game.act('LayTile', layFields(choice))
}

function finishTrackAndStations(game: Table, companyId: string) {
    game.act('FinishTrack', { companyId })
    if (game.state.machineState === 'PlacingStation') game.act('FinishStations', { companyId })
}

function layFields(choice: TrackLayDetails) {
    return {
        companyId: choice.companyId,
        locationId: choice.locationId,
        definitionId: choice.definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    }
}

function privateChoices(game: Table, privateId: string, locationId: string) {
    const state = game.hydrated
    const terms = PrivatePowerRules1850.trackTerms(state, privateId, game.player)
    return terms ? privateTrackConstruction(state, terms, TrackRules1850).choices(locationId) : []
}

function layPrivate(game: Table, privateId: string, locationId: string) {
    const [choice] = privateChoices(game, privateId, locationId)
    assertExists(choice, `${privateId} cannot lay in ${locationId}`)
    game.act('LayPrivateTile', { privateCompanyId: privateId, ...layFields(choice) })
    return choice
}

describe('track allowance (§6, §6.1.1)', () => {
    const gnTurn = (firstTurn: boolean) =>
        prepared((state) => {
            operated(state, 'GN', 'p1')
            getCompany(state, 'GN').operated = !firstTurn
        })

    it('lays one yellow tile a turn', () => {
        const game = gnTurn(false)
        toCompanyTurn(game, 'GN')
        layOrdinary(game, 'D9', '18xx:57')
        expect(TrackRules1850.allowance(game.hydrated, 'yellow', false)).toHaveProperty('reason')
    })

    it('lays two yellow tiles the first time a company operates', () => {
        const game = gnTurn(true)
        toCompanyTurn(game, 'GN')
        layOrdinary(game, 'D9', '18xx:57')
        expect(TrackRules1850.allowance(game.hydrated, 'yellow', false)).toEqual({ cost: 0 })
    })
})

describe('Chicago (§6.1.3)', () => {
    const cbqTurn = () => {
        const game = prepared((state) => {
            operated(state, 'CBQ', 'p1')
        })
        toCompanyTurn(game, 'CBQ')
        return game
    }
    const yellow = (game: Table) =>
        new TrackConstruction(game.hydrated, TrackRules1850)
            .choices(ChicagoLocationId)
            .filter((choice) => choice.definitionId === '1850:128')

    it('never has legs to the northwest and due east, and no leg to the lake', () => {
        const edges = yellow(cbqTurn()).map((choice) => exits(choice.definitionId, choice.rotation))
        expect(edges).not.toContainEqual([2, 4])
        expect(edges.every((legs) => !legs.includes(3))).toBe(true)
        expect(edges).toEqual(
            expect.arrayContaining([
                [0, 2],
                [0, 4],
                [1, 5]
            ])
        )
    })

    it('keeps the CB&Q in the western city', () => {
        const game = cbqTurn()
        for (const choice of yellow(game))
            expect(choice.nodeMapping[WestChicagoNodeId]).toBe(WestChicagoNodeId)
        const home = game.state.stations.find((station) => station.id === 'CBQ:home')
        expect(home?.status === 'placed' && home.position.locationId).toBe(ChicagoLocationId)
    })

    it('joins its two cities in brown', () => {
        const yellowFace = TileSet1850.definitions.find((tile) => tile.id === '1850:129')
        const brownFace = TileSet1850.definitions.find((tile) => tile.id === '1850:130')
        assertExists(yellowFace, 'The set has #129')
        assertExists(brownFace, 'The set has #130')
        expect(TrackRules1850.preservesStops(yellowFace.face, brownFace.face)).toBe(true)
    })
})

describe('private companies in player hands (§15.1)', () => {
    it('keep the bridge and the Mississippi & Missouri’s hexes closed', () => {
        const game = prepared((state) => {
            operated(state, 'MP', 'p1')
        })
        toCompanyTurn(game, 'MP')
        const tiles = new TrackConstruction(game.hydrated, TrackRules1850).choices('L13')
        expect(tiles).toEqual([])
    })

    it('open them once a company owns the private', () => {
        const game = prepared((state) => {
            operated(state, 'MP', 'p1')
            ownPrivate(state, 'MRBC', 'MP')
        })
        toCompanyTurn(game, 'MP')
        expect(new TrackConstruction(game.hydrated, TrackRules1850).choices('L13')).not.toEqual([])
    })
})

describe('the Bridge Company (§15.2)', () => {
    const owned = () => {
        const game = prepared((state) => {
            operated(state, 'MP', 'p1', { cash: 100 })
            ownPrivate(state, 'MRBC', 'MP')
        })
        toCompanyTurn(game, 'MP')
        return game
    }

    it('lays St. Louis free, before the ordinary lay and besides it', () => {
        const game = owned()
        const before = treasury(game, 'MP')
        layPrivate(game, 'MRBC', 'L13')
        expect(treasury(game, 'MP')).toBe(before)
        expect(TrackRules1850.allowance(game.hydrated, 'yellow', false)).toEqual({ cost: 0 })
    })

    it('may not then upgrade that hex in the same turn, and lays only once', () => {
        const game = owned()
        layPrivate(game, 'MRBC', 'L13')
        expect(game.state.bridgeLaid).toBe(true)
        expect(new TrackConstruction(game.hydrated, TrackRules1850).choices('L13')).toEqual([])
        expect(privateChoices(game, 'MRBC', 'L13')).toEqual([])
        game.act('FinishTrack', { companyId: 'MP' })
        expect(game.state.bridgeLaid).toBeUndefined()
    })
})

describe('extra yellow lays (§6.1.2, §15.2)', () => {
    const owner = (privateId: string, cash = 500) => {
        const game = prepared((state) => {
            operated(state, 'GN', 'p1', { cash })
            ownPrivate(state, privateId, 'GN')
        })
        toCompanyTurn(game, 'GN')
        return game
    }

    it('wait for the ordinary lay', () => {
        const game = owner('GBCC')
        expect(PrivatePowerRules1850.trackTerms(game.hydrated, 'GBCC', game.player)).toBeUndefined()
        layOrdinary(game, 'D9', '18xx:57')
        expect(PrivatePowerRules1850.trackTerms(game.hydrated, 'GBCC', game.player)?.layFee).toBe(
            30
        )
    })

    it('charge Gant Brothers’ $30 plus terrain, once a turn', () => {
        const game = owner('GBCC')
        layOrdinary(game, 'D9', '18xx:57', 5)
        const before = treasury(game, 'GN')
        const choice = layPrivate(game, 'GBCC', 'E10')
        expect(choice.cost).toBe(70)
        expect(treasury(game, 'GN')).toBe(before - 70)
        expect(PrivatePowerRules1850.trackTerms(game.hydrated, 'GBCC', game.player)).toBeUndefined()
    })

    it('hold the Crédit Mobilier to west of the Mississippi, once', () => {
        const game = owner('CM')
        layOrdinary(game, 'D9', '18xx:57', 1)
        expect(privateChoices(game, 'CM', 'E10')).toEqual([])
        expect(privateChoices(game, 'CM', 'D7')).not.toEqual([])
        layPrivate(game, 'CM', 'D7')
        expect(privateChoices(game, 'CM', 'D5')).toEqual([])
    })

    it('let the Land Grant go east only once, and count three in all', () => {
        const game = owner('WLGC')
        layOrdinary(game, 'D9', '18xx:57', 5)
        expect(privateChoices(game, 'WLGC', 'E10')).not.toEqual([])
        layPrivate(game, 'WLGC', 'E10')
        expect(game.state.landGrant).toEqual({ lays: 1, usedAnywhere: true })
        const later = prepared((state) => {
            operated(state, 'GN', 'p1')
            ownPrivate(state, 'WLGC', 'GN')
            state.landGrant = { lays: 3, usedAnywhere: true }
        })
        toCompanyTurn(later, 'GN')
        layOrdinary(later, 'D9', '18xx:57')
        expect(
            PrivatePowerRules1850.trackTerms(later.hydrated, 'WLGC', later.player)
        ).toBeUndefined()
    })
})

describe('private income (§4.1.2)', () => {
    it('pays the Crédit Mobilier to the president of the company owning it', () => {
        const game = prepared((state) => {
            operated(state, 'GN', 'p1', { cash: 100 })
            ownPrivate(state, 'CM', 'GN')
        })
        const president = finiteCashOwnedBy(game.state, { kind: 'player', playerId: 'p1' })
        toCompanyTurn(game, 'GN')
        expect(treasury(game, 'GN')).toBe(100)
        expect(
            finiteCashOwnedBy(game.state, { kind: 'player', playerId: 'p1' })
        ).toBeGreaterThanOrEqual(president + 10)
    })
})

describe('private closure (§4.2.4, §4.2.5, §11.4)', () => {
    const effects = (phaseId: string, prepare?: (state: State1850) => void) => {
        const game = prepared((state) => {
            state.phaseId = phaseId
            prepare?.(state)
        })
        return PrivateRules1850.phaseEffects(game.hydrated)
    }

    it('closes GRSC, MRBC, MMC and MMR with the first 5-train; CM, GBCC and WLGC lose their income', () => {
        const result = effects('5')
        expect(
            result
                .filter((effect) => effect.kind === 'close')
                .map((effect) => effect.privateCompanyId)
        ).toEqual(['GRSC', 'MRBC', 'MMC', 'MMR'])
        expect(
            result
                .filter((effect) => effect.kind === 'income')
                .map((effect) => [
                    effect.privateCompanyId,
                    effect.kind === 'income' && effect.revenue
                ])
        ).toEqual([
            ['CM', 0],
            ['GBCC', 0],
            ['WLGC', 0]
        ])
    })

    it('also closes a Crédit Mobilier or Land Grant whose lays are spent', () => {
        const closed = effects('5', (state) => {
            state.usedPrivatePowerIds.push('CM')
            state.landGrant = { lays: 3, usedAnywhere: true }
        })
            .filter((effect) => effect.kind === 'close')
            .map((effect) => effect.privateCompanyId)
        expect(closed).toEqual(expect.arrayContaining(['CM', 'WLGC']))
    })

    it('closes everything left with the first 6-train', () => {
        expect(effects('6').every((effect) => effect.kind === 'close')).toBe(true)
        expect(effects('6')).toHaveLength(7)
    })
})

describe('buying privates (§11.1)', () => {
    const asset = (privateCompanyId: string) => ({ kind: 'private' as const, privateCompanyId })
    const range = (phaseId: string, companyId: string, privateId: string) => {
        const game = prepared((state) => {
            state.phaseId = phaseId
        })
        return TransferRules1850.priceRange(game.hydrated, companyId, asset(privateId))
    }

    it('allows only MRBC and MMC before the 3s, for half to face value', () => {
        expect(range('2', 'GN', 'MRBC')).toEqual({ minimum: 20, maximum: 40 })
        expect(range('2', 'GN', 'MMC')).toEqual({ minimum: 40, maximum: 80 })
        expect(range('2', 'GN', 'GRSC')).toBeUndefined()
    })

    it('allows half to double from the 3s until the 5s', () => {
        expect(range('3', 'GN', 'MMR')).toEqual({ minimum: 80, maximum: 320 })
        expect(range('4', 'GN', 'MRBC')).toEqual({ minimum: 20, maximum: 80 })
        expect(range('5', 'GN', 'WLGC')).toBeUndefined()
    })

    it('lets the Union Pacific alone pay triple for the Crédit Mobilier', () => {
        expect(range('3', 'UP', 'CM')).toEqual({ minimum: 20, maximum: 120 })
        expect(range('3', 'GN', 'CM')).toEqual({ minimum: 20, maximum: 80 })
    })
})

describe('the West area (§6.3)', () => {
    it('takes track from all three of its printed triangles', () => {
        const edges = Map1850.location('F1').preprintedTile.paths.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
        expect(edges.toSorted()).toEqual([3, 4, 5])
        expect(Map1850.neighbor('F1', 3)?.id).toBe('E2')
    })
})

describe('the Mesabi Range (§6.5.1, §15.2)', () => {
    const ready = (prepare: (state: State1850) => void = () => {}, cash = 200) => {
        const game = prepared((state) => {
            operated(state, 'NP', 'p1', { cash })
            state.tileInventory = TileSet1850.createInventory([
                { locationId: 'B11', definitionId: '18xx:57', rotation: 2 }
            ])
            prepare(state)
        })
        toCompanyTurn(game, 'NP')
        return game
    }

    it('sells no token while a player owns the private', () => {
        const game = ready()
        expect(MesabiRights.canBuy(game.hydrated, game.player)).toBe(false)
    })

    it('gives the private’s buyer a token and half of each $80', () => {
        const game = prepared((state) => {
            operated(state, 'GN', 'p1', { cash: 500 })
            operated(state, 'NP', 'p1', { cash: 200, price: 90 })
            state.tileInventory = TileSet1850.createInventory([
                { locationId: 'B11', definitionId: '18xx:57', rotation: 2 }
            ])
            ownPrivate(state, 'MMC', 'GN')
            state.mesabiRights = ['GN']
        })
        toCompanyTurn(game, 'GN')
        finishTrackAndStations(game, 'GN')
        game.act('FinishOperatingTurn', { companyId: 'GN' })
        expect(game.state.trackStep?.companyId).toBe('NP')
        const gn = treasury(game, 'GN')
        const np = treasury(game, 'NP')
        game.act('BuyStopRights', { companyId: 'NP' })
        expect(treasury(game, 'GN')).toBe(gn + 40)
        expect(treasury(game, 'NP')).toBe(np - 80)
        expect(game.state.mesabiRights).toEqual(['GN', 'NP'])
        expect(TrackRules1850.allowance(game.hydrated, 'yellow', false)).toHaveProperty('reason')
    })

    it('pays the whole $80 to the bank once the private has closed', () => {
        const game = ready((state) => {
            const company = getCompany(state, 'MMC')
            company.closed = true
        })
        const np = treasury(game, 'NP')
        game.act('BuyStopRights', { companyId: 'NP' })
        expect(treasury(game, 'NP')).toBe(np - 80)
    })

    it('runs out after four tokens', () => {
        const game = ready((state) => {
            getCompany(state, 'MMC').closed = true
            state.mesabiRights = ['GN', 'UP', 'SOO', 'MP']
        })
        expect(MesabiRights.access.remaining(game.hydrated)).toBe(0)
        expect(MesabiRights.canBuy(game.hydrated, game.player)).toBe(false)
    })

    it('closes the Range to routes without a token', () => {
        const center = { locationId: 'A10', nodeId: 'town' }
        const game = ready()
        expect(RouteRules1850.stopAllowed?.(game.hydrated, 'NP', center)).toBe(false)
        const after = ready((state) => {
            state.mesabiRights = ['NP']
        })
        expect(RouteRules1850.stopAllowed?.(after.hydrated, 'NP', center)).toBe(true)
    })
})

describe('a forced sale closing the company it funds (§5.1.1, §10.7.2)', () => {
    const fundingAtTheBottom = () => {
        const game = prepared((state) => {
            for (const company of state.companies)
                if (company.kind === 'private') company.closed = true
            operated(state, 'GN', 'p1', { price: 76, shares: 6, cash: 0 })
            placeStockMarker(state.stockMarket, 'GN', '6:0')
            state.cash = state.cash.map((account) =>
                account.owner.kind === 'player' && account.owner.playerId === 'p1'
                    ? { ...account, amount: 5 }
                    : account
            )
            state.tileInventory = TileSet1850.createInventory(trackAlong(['D9', 'C8', 'B7']))
        })
        toCompanyTurn(game, 'GN')
        game.act('FinishTrack', { companyId: 'GN' })
        const funding = () =>
            new EmergencyTrainFunding(
                game.hydrated,
                TrainFundingRules1850,
                StockRules1850,
                TrainRules1850
            )
        const [purchase] = funding().purchases()
        game.act('FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
        return { game, funding }
    }

    it('loses the president’s money with the company, and ends its turn', () => {
        const { game, funding } = fundingAtTheBottom()
        const next = funding().next()
        if (next.kind !== 'sell') throw new Error(`Funding expects ${next.kind}`)
        const [sale] = next.sales
        expect(sale.sales[0].shares).toBe(1)
        game.act('SellFundingShares', {
            seller: next.owner,
            companyId: 'GN',
            shares: 1,
            expectedProceeds: sale.proceeds
        })
        expect(getCompany(game.state, 'GN').closed).toBe(true)
        expect(game.state.trainFunding).toBeUndefined()
        expect(game.state.machineState).not.toBe('FundingTrain')
        expect(finiteCashOwnedBy(game.state, { kind: 'player', playerId: 'p1' })).toBe(0)
        const closure = game.actions.find((action) => action.type === 'CloseCorporation')
        expect(closure?.metadata).toMatchObject({
            forfeit: { from: { kind: 'player', playerId: 'p1' }, amount: 15 }
        })
    })
})

describe('the compulsory train (§8.1c, §10.1)', () => {
    const duluthToRange = (rights: readonly string[]) =>
        prepared((state) => {
            operated(state, 'NP', 'p1')
            state.tileInventory = TileSet1850.createInventory(trackAlong(['B11', 'A10']))
            state.mesabiRights = [...rights]
        })

    it('is not needed for a route open only to a Mesabi token', () => {
        const game = duluthToRange([])
        expect(TrainRules1850.requiresTrain(game.hydrated, 'NP')).toBe(false)
    })

    it('is needed once the company holds one', () => {
        const game = duluthToRange(['NP'])
        expect(TrainRules1850.requiresTrain(game.hydrated, 'NP')).toBe(true)
    })
})

describe('edge tokens (§7.4, §8.4)', () => {
    const atStations = (prepare: (state: State1850) => void = () => {}) => {
        const game = prepared((state) => {
            operated(state, 'UP', 'p1', { cash: 200 })
            state.tileInventory = TileSet1850.createInventory(trackAlong(['I4', 'H3', 'G2', 'F1']))
            giveTrain(state, 'UP', '4')
            prepare(state)
        })
        toCompanyTurn(game, 'UP')
        return game
    }

    it('costs $50 and is the turn’s token placement', () => {
        const game = atStations()
        game.act('FinishTrack', { companyId: 'UP' })
        expect(game.state.machineState).toBe('PlacingStation')
        const before = treasury(game, 'UP')
        expect(game.valid()).toContain('PlaceEdgeToken')
        game.act('PlaceEdgeToken', { companyId: 'UP' })
        expect(treasury(game, 'UP')).toBe(before - 50)
        expect(game.state.edgeTokens).toEqual(['UP'])
        expect(game.state.machineState).not.toBe('PlacingStation')
    })

    it('doubles the area for its company alone, at each phase’s value', () => {
        const game = atStations((state) => {
            state.edgeTokens = ['UP']
        })
        const west = { locationId: 'F1', nodeId: 'offboard' }
        expect(edgeBonus(game.hydrated, 'UP', west)).toBe(30)
        expect(edgeBonus(game.hydrated, 'GN', west)).toBe(0)
        expect(edgeBonus(game.hydrated, 'UP', { locationId: 'A2', nodeId: 'offboard' })).toBe(0)
    })

    it('counts on a route, and does not stand as its station', () => {
        const game = atStations((state) => {
            state.edgeTokens = ['UP']
        })
        finishTrackAndStations(game, 'UP')
        const trainId = game.state.trainInventory.trains.find(
            (train) => train.status === 'owned' && train.owner.kind === 'company'
        )?.id
        assertExists(trainId, 'The Union Pacific owns a train')
        const evaluation = new RouteEvaluation(game.hydrated, RouteRules1850).evaluate('UP', [
            route(game.state, trainId, { locationId: 'I4', nodeId: 'city' }, ['H3', 'G2', 'F1'])
        ])
        expect(evaluation.result?.revenue).toBe(20 + 60)
        expect(
            game.state.stations.some(
                (station) => station.status === 'placed' && station.position.locationId === 'F1'
            )
        ).toBe(false)
    })

    it('counts the Northwest together across both its hexes', () => {
        const game = atStations((state) => {
            state.edgeTokens = ['GN']
        })
        expect(edgeBonus(game.hydrated, 'GN', { locationId: 'A2', nodeId: 'offboard' })).toBe(30)
        expect(edgeBonus(game.hydrated, 'GN', { locationId: 'B1', nodeId: 'offboard' })).toBe(30)
    })
})

describe('new trains (§10.3)', () => {
    it('buys one a turn from the bank', () => {
        const game = prepared((state) => {
            operated(state, 'GN', 'p1', { cash: 800 })
            state.tileInventory = TileSet1850.createInventory([
                { locationId: 'D9', definitionId: '18xx:57', rotation: 0 }
            ])
        })
        toCompanyTurn(game, 'GN')
        finishTrackAndStations(game, 'GN')
        buyTrain(game, '2')
        expect(TrainRules1850.purchaseLimit(game.hydrated, 'GN')).toBe(1)
        expect(
            new TrainPurchase(game.hydrated, TrainRules1850)
                .offers()
                .filter((offer) => offer.evaluation.details)
        ).toEqual([])
    })
})

describe('half dividends (§9.1.2)', () => {
    it('round each share up, leaving the company the rest', () => {
        const retained = EarningsRules1850.retainedRevenue
        const game = prepared((state) => {
            operated(state, 'GN', 'p1')
        })
        expect(retained(game.hydrated, 'GN', 'half-pay', 130)).toBe(60)
        expect(retained(game.hydrated, 'GN', 'half-pay', 120)).toBe(60)
        expect(retained(game.hydrated, 'GN', 'withhold', 130)).toBe(130)
        expect(retained(game.hydrated, 'GN', 'pay', 130)).toBe(0)
    })
})

describe('phases (§4.2, §21)', () => {
    it('reads off-board values first to the 4s, second to the 6s, then last', () => {
        expect(revenueStages('4')).toEqual(['yellow'])
        expect(revenueStages('6')).toEqual(['yellow', 'brown'])
        expect(revenueStages('8')).toEqual(['yellow', 'brown', 'gray'])
    })

    it('scraps 2s with the first 4, 3s with the 6, 4s with the 8 and 5s with the 12', () => {
        expect(Phases1850.rustTiming('4', '2')).toBe('immediate')
        expect(Phases1850.rustTiming('6', '3')).toBe('immediate')
        expect(Phases1850.rustTiming('8', '4')).toBe('immediate')
        expect(Phases1850.rustTiming('12', '5')).toBe('immediate')
        expect(Phases1850.rustTiming('12', '6')).toBeUndefined()
    })

    it('brings brown with the 5s and grey only with the 8s', () => {
        expect(Phases1850.phase('5').tileColors).toContain('brown')
        expect(Phases1850.phase('6').tileColors).not.toContain('gray')
        expect(Phases1850.phase('8').tileColors).toContain('gray')
    })

    it('limits trains and rounds as the table says', () => {
        expect(['2', '3', '4', '5', '6'].map((id) => Phases1850.phase(id).trainLimit)).toEqual([
            4, 4, 3, 2, 2
        ])
        expect(['2', '3', '4', '5'].map((id) => Phases1850.phase(id).operatingRounds)).toEqual([
            1, 2, 2, 3
        ])
    })
})
