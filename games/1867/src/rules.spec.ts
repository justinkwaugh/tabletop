import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { RailwayMapState, getCompany, homeStationId, type StationPosition } from '@tabletop/18xx'
import {
    auctionMinor,
    edit,
    finishStockRound,
    kit,
    opened,
    operateRound,
    setCash
} from '../test/kit.js'
import { CnId } from './companies.js'
import { Map1867 } from './map.js'
import { CnMontrealStationId } from './national.js'
import { EndingRules1867, OperatingRules1867, TrainRules1867 } from './operating.js'
import { CompanyRules1867, StockRules1867 } from './stock.js'
import { TileSet1867 } from './tiles.js'
import { TrackRules1867 } from './track.js'
import { TrainDepot1867 } from './trains.js'

const at = (positions: readonly StationPosition[], locationId: string, nodeId: string) =>
    positions.some((position) => position.locationId === locationId && position.nodeId === nodeId)

/** A minor auctioned into the city, its stock round over and its operating turn under way. */
function operating(minorId: string, home: { locationId: string; nodeId: string }) {
    const game = opened(3)
    auctionMinor(game, minorId, home)
    finishStockRound(game)
    return game
}

/** Ends the minor's operating turn without building, running or buying. */
function finishTurn(game: ReturnType<typeof opened>, companyId: string): void {
    const steps = ['LayingTrack', 'PlacingStation', 'RunningTrains', 'DistributingEarnings']
    while (steps.includes(game.state.machineState)) {
        const valid = game.valid()
        if (valid.includes('FinishTrack')) game.act('FinishTrack', { companyId })
        else if (valid.includes('FinishStations')) game.act('FinishStations', { companyId })
        else if (valid.includes('RunTrains')) game.act('RunTrains', { companyId, routes: [] })
        else game.act('DistributeEarnings', { companyId, choice: 'half-pay' })
    }
}

describe('1867 setup', () => {
    it('puts the Canadian National’s station in Toronto (GTG §2.H)', () => {
        const game = kit.table(4)
        expect(game.state.stations.find((station) => station.id === homeStationId(CnId))).toEqual({
            id: homeStationId(CnId),
            companyId: CnId,
            status: 'placed',
            position: { locationId: 'F16', nodeId: 'city-0', slot: 0 }
        })
    })

    it('removes two privates at random for two players (GTG §16.2)', () => {
        const game = kit.table(2)
        const closed = game.state.companies.filter(
            (company) => company.kind === 'private' && company.closed
        )
        expect(closed).toHaveLength(2)
    })
})

describe('1867 minor homes', () => {
    it('offers any city with no station, Toronto’s second city but not the CN’s (GTG §7.2.1)', () => {
        const game = opened(3)
        const homes = StockRules1867.companyAuction?.homes(game.hydrated, 'AE') ?? []
        expect(at(homes, 'F16', 'city-1')).toBe(true)
        expect(at(homes, 'F16', 'city-0')).toBe(false)
        expect(at(homes, 'E17', 'city')).toBe(true)
        expect(at(homes, 'L12', 'city-0')).toBe(true)
    })

    it('opens the green city spaces of Montreal and Timmins from phase 3 (GTG §7.2.1)', () => {
        const game = opened(3)
        const homes = () => StockRules1867.companyAuction?.homes(game.hydrated, 'AE') ?? []
        expect(at(homes(), 'L12', 'city-2')).toBe(false)
        expect(at(homes(), 'D2', 'city')).toBe(false)
        edit(game, (state) => {
            state.phaseId = '3'
        })
        expect(at(homes(), 'L12', 'city-2')).toBe(true)
        expect(at(homes(), 'D2', 'city')).toBe(true)
    })

    it('offers the green minors only from phase 3 (GTG §3.2)', () => {
        const game = opened(3)
        expect(StockRules1867.companyAuction?.homes(game.hydrated, 'BBG')).toEqual([])
        edit(game, (state) => {
            state.phaseId = '3'
        })
        expect(StockRules1867.companyAuction?.homes(game.hydrated, 'BBG')?.length).toBeGreaterThan(
            0
        )
    })

    it('takes no second minor into a city with a station (GTG §7.2.1)', () => {
        const game = opened(3)
        auctionMinor(game, 'AE', { locationId: 'E17', nodeId: 'city' })
        const homes = StockRules1867.companyAuction?.homes(game.hydrated, 'BO') ?? []
        expect(at(homes, 'E17', 'city')).toBe(false)
    })
})

describe('1867 track', () => {
    it('keeps the locked hex closed until phase 3 (GTG §8.6)', () => {
        const game = operating('AE', { locationId: 'F16', nodeId: 'city-1' })
        const request = {
            companyId: 'AE',
            locationId: 'M13',
            definitionId: '18xx:3',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRules1867.restriction(game.hydrated, request)).toMatch(/locked/)
        edit(game, (state) => {
            state.phaseId = '3'
        })
        expect(TrackRules1867.restriction(game.hydrated, request)).toBeUndefined()
    })

    it('makes a yellow tile connect to the yellow triangle (GTG §8.6.2)', () => {
        const game = operating('AE', { locationId: 'G15', nodeId: 'city' })
        const lay = (rotation: 0 | 1) => ({
            companyId: 'AE',
            locationId: 'G15',
            definitionId: '18xx:57',
            rotation,
            nodeMapping: {}
        })
        const before = new RailwayMapState(Map1867, TileSet1867, game.hydrated.tileInventory).tile(
            'G15'
        )
        expect(TrackRules1867.placementRestriction?.(lay(0), before)).toMatch(/triangle/)
        expect(TrackRules1867.placementRestriction?.(lay(1), before)).toBeUndefined()
    })
})

describe('1867 home hexes', () => {
    it('lays a company’s first tile in its home hex while it has no track (RoP §10.4)', () => {
        const game = operating('AE', { locationId: 'M9', nodeId: 'city' })
        const lay = (locationId: string) => ({
            companyId: 'AE',
            locationId,
            definitionId: '18xx:7',
            rotation: 0 as const,
            nodeMapping: {}
        })
        expect(TrackRules1867.restriction(game.hydrated, lay('M7'))).toMatch(/home hex/)
        expect(TrackRules1867.restriction(game.hydrated, lay('M9'))).toBeUndefined()
    })

    it('never starts a major in Toronto, whose other city holds the CN (designer)', () => {
        const game = opened(3)
        edit(game, (state) => {
            state.phaseId = '4'
        })
        const homes = CompanyRules1867.startHomes?.(game.hydrated, 'CPR', 'any') ?? []
        expect(homes.length).toBeGreaterThan(0)
        expect(homes.some((home) => home.locationId === 'F16')).toBe(false)
    })
})

describe('1867 nationalisation', () => {
    it('drops the price a space and two a loan, pays the owner, and gives the CN the station (GTG §10.1)', () => {
        const game = operating('AE', { locationId: 'E17', nodeId: 'city' })
        edit(game, (state) => {
            setCash(state, 'AE', 0)
            getCompany(state, 'AE').loans = 2
        })
        finishTurn(game, 'AE')
        const settle = game.actions.findLast((action) => action.type === 'SettleLoans')
        const details = JSON.stringify(settle?.metadata)
        expect(details).toContain('nationalisation')
        // $50 falls past $45 and $40 to the floor at $35; the minor's certificate is two shares.
        expect(details).toContain('"price":35')
        expect(getCompany(game.state, 'AE').closed).toBe(true)
        expect(details).toContain('"amount":70')
        expect(
            game.state.stations.some(
                (station) =>
                    station.companyId === CnId &&
                    station.status === 'placed' &&
                    station.position.locationId === 'E17'
            )
        ).toBe(true)
    })
})

describe('1867 Canadian National', () => {
    it('exports the next train at the end of each operating round in phases 4 to 7 (GTG §8.13)', () => {
        const game = operating('AE', { locationId: 'E17', nodeId: 'city' })
        expect(OperatingRules1867.trainsToExport?.(game.hydrated)).toEqual([])
        edit(game, (state) => {
            state.phaseId = '4'
        })
        expect(OperatingRules1867.trainsToExport?.(game.hydrated)).toEqual(['2'])
    })

    it('lets a major trade a train in for half its price in phase 8 (designer’s ruling)', () => {
        const game = kit.table(4)
        const state = game.hydrated
        const five = { definitionId: '5' }
        expect(TrainRules1867.exchangePrice(state, 'CPR', '8', five)).toBeUndefined()
        edit(game, (next) => {
            next.phaseId = '8'
        })
        expect(TrainRules1867.exchangePrice(game.hydrated, 'CPR', '8', five)).toBe(725)
        expect(TrainRules1867.exchangePrice(game.hydrated, 'AE', '8', five)).toBeUndefined()
        expect(
            TrainRules1867.exchangePrice(game.hydrated, 'CPR', '8', { definitionId: '8' })
        ).toBeUndefined()
        expect(
            TrainRules1867.exchangePrice(game.hydrated, 'CPR', '8', { definitionId: '2+2' })
        ).toBe(700)
    })
    it('keeps its Montreal station for the grey tile, placing none as phase 8 begins (RoP §7.4)', () => {
        const game = operating('AE', { locationId: 'E17', nodeId: 'city' })
        edit(game, (state) => {
            state.phaseId = '7'
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => train.status !== 'depot' || train.definitionId === '8'
            )
            setCash(state, 'AE', 2000)
        })
        finishTurn(game, 'AE')
        const eight = TrainDepot1867.nextTrain(game.state.trainInventory, '8')
        assertExists(eight, 'The 8-train is in the depot')
        game.act('BuyTrain', {
            companyId: 'AE',
            trainId: eight.id,
            definitionId: '8',
            expectedPrice: TrainDepot1867.trainDefinition('8').price
        })
        expect(game.state.phaseId).toBe('8')
        expect(getCompany(game.state, 'AE').closed).toBe(true)
        expect(
            game.state.stations.find((station) => station.id === CnMontrealStationId)?.status
        ).toBe('available')
    })
})

describe('1867 ending', () => {
    it('ends three operating rounds after the stock round that follows the first 8-train’s set (GTG §12.1)', () => {
        const game = kit.table(4)
        edit(game, (state) => {
            state.finalPhaseAt = { set: 5, round: 1 }
        })
        expect(EndingRules1867.trigger(game.hydrated)).toEqual({
            reason: 'First 8-train',
            finalOperatingSet: 6,
            finalOperatingRounds: 3
        })
    })
})

describe('1867 Canadian National privates', () => {
    it('pays the CN no income from the privates it holds (GTG §8.13)', () => {
        const game = kit.table(4)
        const cn = { kind: 'company' as const, companyId: CnId }
        edit(game, (state) => {
            const certificate = state.certificates.find((entry) => entry.companyId === 'SCT')
            if (certificate) certificate.owner = cn
        })
        expect(OperatingRules1867.privateIncome?.(game.hydrated, 'SCT')).toBe(0)
        expect(OperatingRules1867.privateIncome?.(game.hydrated, 'QB')).toBe(25)
    })
})

describe('1867 merger round', () => {
    // The designer rules the order in his Rules of Play (RoP §12.3) definitive over GTG §9.2C.
    it('makes the earliest minor’s owner director on a tie, buying first; a larger holding takes over', () => {
        const game = opened(3)
        const later = game.player
        auctionMinor(game, 'BO', { locationId: 'D16', nodeId: 'city' }, 100)
        const earlier = game.player
        auctionMinor(game, 'AE', { locationId: 'E15', nodeId: 'city' }, 140)
        finishStockRound(game)
        edit(game, (state) => {
            state.phaseId = '3'
            state.tileInventory = TileSet1867.createInventory(kit.trackAlong(['D16', 'E15']))
        })
        operateRound(game)
        expect(game.state.machineState).toBe('MergerRound')
        // AE, the dearer minor, operated first and is offered first; its owner passes.
        expect(game.player).toBe(earlier)
        game.act('PassMerger', { minorId: 'AE' })
        expect(game.player).toBe(later)
        game.act('ProposeMerger', {
            kind: 'merge',
            minorId: 'BO',
            minorIds: ['BO', 'AE'],
            majorId: 'CPR'
        })
        game.act('AnswerMerger', { accept: true })
        // One share each: the tie goes to AE's owner, who directs and buys first.
        expect(game.state.mergerRound?.proposal).toMatchObject({
            stage: 'shareholders',
            directorId: earlier
        })
        expect(game.player).toBe(earlier)
        game.act('BuyMergerShares', { shares: 1 })
        expect(game.player).toBe(later)
        game.act('BuyMergerShares', { shares: 2 })
        expect(game.state.mergerRound?.proposal?.directorId).toBe(later)
        expect(getCompany(game.state, 'CPR').started).toBe(true)
    })
})
