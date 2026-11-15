import { describe, expect, it } from 'vitest'
import {
    EarningsDistribution,
    EmergencyTrainFunding,
    RouteEvaluation,
    StationPlacement,
    TrackConstruction,
    corporateFinanceChoices,
    homeStationId,
    type TileRotation,
    finalWealth,
    placeStockMarker
} from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import { company, giveCharter, layTiles, player, runMinor, setCash } from '../test/positions.js'
import {
    LondonLocationId,
    MetropolitanId,
    concessionId,
    destinationStationId,
    major1822,
    minor1822
} from './companies.js'
import { LondonNodeIds } from './faces.js'
import {
    layRestriction1822,
    londonConsentPlayerId1822,
    londonTrackHolders1822
} from './layRestriction.js'
import { playerLoan1822 } from './loans.js'
import {
    CorporateFinanceRules1822,
    EarningsRules1822,
    EndingRules1822,
    TrainFundingRules1822,
    TrainRules1822,
    privateIncome1822
} from './operating.js'
import { operatingOrder1822 } from './order.js'
import { FranceLocationId } from './map.js'
import { placeDestinationToken1822 } from './destinations.js'
import { EnglishChannelLocationId } from './privates.js'
import { RouteRules1822 } from './routes.js'
import type { State1822 } from './state.js'
import { StationRules1822 } from './stations.js'
import { tokenSpace1822 } from './tokens.js'
import { StockRules1822 } from './stock.js'
import { EndGameSpaceId1822, Market1822 } from './stockMarket.js'
import { EnglishChannelTileIds1822, LondonTileIds1822 } from './tiles.js'
import { TrackRules1822 } from './track.js'

function prepared(prepare: (state: State1822, players: string[]) => void, count = 4): Table {
    const game = kit.table(count, 3)
    const state = structuredClone(game.state)
    prepare(state, state.turnManager.turnOrder)
    game.state = state
    return game
}

describe('operating order (§5.2)', () => {
    it('runs minors before majors, each by descending share value', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            runMinor(state, 'M4', first, { price: 60 })
            runMinor(state, 'M5', first, { price: 90 })
            kit.operated(state, 'CR', first, { price: 100 })
            kit.operated(state, 'MR', first, { price: 70 })
        })
        expect(operatingOrder1822(game.state)).toEqual(['M5', 'M4', 'CR', 'MR'])
    })
})

describe('track (§5.8.13)', () => {
    const allowance = (state: State1822, companyId: string, colors: string[], color: string) =>
        TrackRules1822.allowance(
            {
                ...state,
                trackStep: {
                    companyId,
                    completed: false,
                    lays: colors.map((laid, index) => ({
                        locationId: `test-${index}`,
                        definitionId: laid === 'yellow' ? '18xx:9' : '18xx:80'
                    }))
                }
            },
            color
        )
    const allowed = (result: ReturnType<typeof allowance>) => !('reason' in result)

    it('gives a minor one tile a turn, green from phase 3 and never brown', () => {
        const game = prepared((state, [first]) => runMinor(state, 'M4', first))
        const state = game.state
        expect(allowed(allowance(state, 'M4', [], 'yellow'))).toBe(true)
        expect(allowed(allowance(state, 'M4', ['yellow'], 'yellow'))).toBe(false)
        expect(allowed(allowance(state, 'M4', [], 'green'))).toBe(false)
        expect(allowed(allowance({ ...state, phaseId: '3' }, 'M4', [], 'green'))).toBe(true)
        expect(allowed(allowance({ ...state, phaseId: '5' }, 'M4', [], 'brown'))).toBe(false)
    })

    it('gives a major one yellow tile in phase 2, then two yellow tiles or one upgrade', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first))
        const at = (phaseId: string) => ({ ...game.state, phaseId })
        expect(allowed(allowance(at('2'), 'CR', ['yellow'], 'yellow'))).toBe(false)
        expect(allowed(allowance(at('3'), 'CR', ['yellow'], 'yellow'))).toBe(true)
        expect(allowed(allowance(at('3'), 'CR', ['yellow', 'yellow'], 'yellow'))).toBe(false)
        expect(allowed(allowance(at('3'), 'CR', ['yellow'], 'green'))).toBe(false)
        expect(allowed(allowance(at('3'), 'CR', ['green'], 'yellow'))).toBe(false)
        expect(allowed(allowance(at('5'), 'CR', [], 'brown'))).toBe(true)
        expect(allowed(allowance(at('5'), 'CR', [], 'gray'))).toBe(false)
    })
})

describe('the hexes beside London (§5.10.7)', () => {
    // L39 lies beside the Great Western's London station, its track leaving London to the south-west.
    const beside = 'L39'
    const lay = (companyId: string, rotation: TileRotation) => ({
        companyId,
        locationId: beside,
        definitionId: '18xx:9',
        rotation,
        nodeMapping: {}
    })
    const joining = ([0, 1, 2, 3, 4, 5] as const).filter(
        (rotation) => !layRestriction1822(bare().hydrated, lay('M4', rotation))
    )
    function bare(): Table {
        return prepared((state, [first]) => runMinor(state, 'M4', first))
    }

    it('takes only a tile that joins the London station while no one holds the hex', () => {
        const state = bare().hydrated
        expect(londonTrackHolders1822(state, beside)).toEqual([])
        expect(joining).toHaveLength(2)
        expect(londonConsentPlayerId1822(state, lay('M4', 0))).toBeUndefined()
    })

    it('is its concession holder’s to lay on freely, and another’s only with their agreement', () => {
        const game = prepared((state, [first, second]) => {
            giveCharter(state, concessionId('GWR'), player(first))
            runMinor(state, 'M4', first)
            runMinor(state, 'M5', second)
        })
        const state = game.hydrated
        const [first] = game.state.turnManager.turnOrder
        expect(londonTrackHolders1822(state, beside)).toEqual([first])
        for (const rotation of [0, 1, 2, 3, 4, 5] as const)
            expect(layRestriction1822(state, lay('M4', rotation))).toBeUndefined()
        expect(londonConsentPlayerId1822(state, lay('M4', 0))).toBeUndefined()
        expect(londonConsentPlayerId1822(state, lay('M5', 0))).toBe(first)
        expect(
            londonConsentPlayerId1822(state, { ...lay('M5', 0), definitionId: '18xx:80' })
        ).toBeUndefined()
    })

    it('passes to the company’s director, and is shared by the Metropolitan Railway beside it', () => {
        const game = prepared((state, [first, second]) => {
            kit.operated(state, 'GWR', first, { price: 100, shares: 6 })
            runMinor(state, MetropolitanId, second)
            const home = major1822('GWR')?.home
            if (!home) throw new Error('The Great Western starts in London')
            state.stations = state.stations.map((station) =>
                station.id === homeStationId(MetropolitanId)
                    ? {
                          id: station.id,
                          companyId: MetropolitanId,
                          status: 'placed',
                          position: { ...home, slot: 1 }
                      }
                    : station
            )
        })
        const [first, second] = game.state.turnManager.turnOrder
        expect(londonTrackHolders1822(game.hydrated, beside)).toEqual([first, second])
        expect(londonConsentPlayerId1822(game.hydrated, lay(MetropolitanId, 0))).toBeUndefined()
    })

    it('lets a third company ask either holder where the Metropolitan shares the station', () => {
        const game = prepared((state, [first, second, third]) => {
            kit.operated(state, 'GWR', first, { price: 100, shares: 6 })
            runMinor(state, MetropolitanId, second)
            runMinor(state, 'M5', third)
            const home = major1822('GWR')?.home
            if (!home) throw new Error('The Great Western starts in London')
            state.stations = state.stations.map((station) =>
                station.id === homeStationId(MetropolitanId)
                    ? {
                          id: station.id,
                          companyId: MetropolitanId,
                          status: 'placed',
                          position: { ...home, slot: 1 }
                      }
                    : station
            )
        })
        const [first, second] = game.state.turnManager.turnOrder
        const state = game.hydrated
        state.trackStep = { companyId: 'M5', lays: [], completed: false }
        expect(new TrackConstruction(state, TrackRules1822).consenters(lay('M5', 0))).toEqual([
            first,
            second
        ])
    })

    it('keeps the Metropolitan Railway from upgrading London in the turn it places its home (§5.6.7)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, MetropolitanId, first)
            state.debutCompanyIds = [MetropolitanId]
        })
        const [yellow] = LondonTileIds1822
        expect(
            layRestriction1822(game.hydrated, {
                companyId: MetropolitanId,
                locationId: LondonLocationId,
                definitionId: yellow,
                rotation: 0,
                nodeMapping: {}
            })
        ).toMatch(/home station/)
    })
})

const ranRoute = {
    start: { locationId: 'E6', nodeId: 'city' },
    paths: [],
    visits: [],
    payments: [],
    distance: 0
}

describe('dividends (§5.14)', () => {
    const effect = (
        state: State1822,
        companyId: string,
        choice: 'pay' | 'half-pay' | 'withhold',
        revenue: number
    ) => {
        const retained = EarningsRules1822.retainedRevenue(state, companyId, choice, revenue)
        const move = EarningsRules1822.marketEffect(state, companyId, {
            choice,
            revenue,
            retained,
            baseDividendPerShare: 0
        }).move
        return { retained, to: move ? Market1822.space(move.toMarketSpaceId).price : undefined }
    }

    it('moves a major by what it pays against its share value', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first, { price: 100 }))
        const state = game.state
        expect(effect(state, 'CR', 'withhold', 300)).toEqual({ retained: 300, to: 90 })
        expect(effect(state, 'CR', 'pay', 0).to).toBe(90)
        expect(effect(state, 'CR', 'pay', 90).to).toBeUndefined()
        expect(effect(state, 'CR', 'pay', 100).to).toBe(110)
        expect(effect(state, 'CR', 'pay', 200).to).toBe(120)
        // Half is rounded up to the next £10: £150 pays £80 and keeps £70 (§5.14.1).
        expect(effect(state, 'CR', 'half-pay', 150)).toEqual({ retained: 70, to: undefined })
        expect(effect(state, 'CR', 'half-pay', 200).to).toBe(110)
    })

    it('decides a permanent 2-train’s revenue apart from the other trains’ (§5.14.2, §5.14.3)', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first, { price: 100 }))
        const state = game.state
        const kept = (
            choice: 'pay' | 'half-pay' | 'withhold',
            separate: 'pay' | 'half-pay' | 'withhold'
        ) =>
            EarningsRules1822.retainedRevenue(state, 'CR', choice, 200, {
                choice: separate,
                revenue: 50
            })
        // The other trains' £150 kept and the 2P's £50 paid: £50 is the dividend.
        expect(kept('withhold', 'pay')).toBe(150)
        expect(kept('pay', 'withhold')).toBe(50)
        // Half of £150 is £80, with the 2P's £50 in full.
        expect(kept('half-pay', 'pay')).toBe(200 - 130)
        // Both paying half are halved as one sum of £200.
        expect(kept('half-pay', 'half-pay')).toBe(100)
        const running = game.hydrated
        running.routeStep = {
            companyId: 'CR',
            result: {
                companyId: 'CR',
                revenue: 200,
                routes: [
                    { ...ranRoute, trainId: 'a', definitionId: '3', revenue: 150 },
                    { ...ranRoute, trainId: 'b', definitionId: '2P', revenue: 50 }
                ]
            }
        }
        const distribution = new EarningsDistribution(running, EarningsRules1822)
        expect(distribution.separateRevenue('CR')).toBe(50)
        const details = distribution.evaluate('CR', 'withhold', 'pay').details
        expect(details).toMatchObject({
            retained: 150,
            dividendPerShare: 5,
            separate: { choice: 'pay', revenue: 50 }
        })
        // £50 paid is under the share value of £100, so the price stays (§5.14.6).
        expect(details?.marketMove).toBeUndefined()
    })

    it('has a minor always split its earnings and move right when it pays', () => {
        const game = prepared((state, [first]) => runMinor(state, 'M4', first, { price: 60 }))
        const state = game.state
        expect(EarningsRules1822.choices(state, 'M4')).toEqual(['pay'])
        expect(
            EarningsRules1822.holderDividend?.(state, 'M4', {
                shares: 2,
                choice: 'pay',
                revenue: 30
            })
        ).toBe(15)
        expect(effect(state, 'M4', 'pay', 30).to).toBe(70)
        expect(effect(state, 'M4', 'pay', 0).to).toBe(50)
    })
})

describe('trains (§5.5, §5.15)', () => {
    it('limits minors and majors by phase', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M4', first)
            kit.operated(state, 'CR', first)
        })
        const limits = (phaseId: string) => {
            const state = { ...game.state, phaseId }
            return [TrainRules1822.trainLimit(state, 'M4'), TrainRules1822.trainLimit(state, 'CR')]
        }
        expect(limits('1')).toEqual([2, 4])
        expect(limits('3')).toEqual([2, 4])
        expect(limits('4')).toEqual([1, 3])
        expect(limits('5')).toEqual([1, 2])
    })

    it('sells the next new train, either side of its card, and flips an L to a 2 for £80', () => {
        const game = prepared((state, [first]) => runMinor(state, 'M4', first))
        const state = game.state
        expect(TrainRules1822.availableDefinitions(state)).toEqual(['L', '2'])
        expect(TrainRules1822.availableDefinitions({ ...state, phaseId: '3' })).toEqual(['2'])
        const train = { id: 'x', definitionId: 'L', status: 'owned' as const, owner: company('M4') }
        expect(TrainRules1822.exchangePrice(state, 'M4', '2', train)).toBe(80)
        expect(
            TrainRules1822.exchangePrice({ ...state, phaseId: '3' }, 'M4', '2', train)
        ).toBeUndefined()
    })

    it('has a director borrow what their cash and shares cannot raise, at half as much again (§5.17.2)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '4'
            kit.operated(state, 'CR', first, { price: 100, shares: 2, cash: 140 })
            setCash(state, player(first), 20)
            // The 3-trains are gone, so a 4-train at £300 is the cheapest in the bank.
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => !['L', '3'].includes(train.definitionId)
            )
        })
        const state = game.hydrated
        const [first] = state.turnManager.turnOrder
        state.trainPurchaseStep = { companyId: 'CR', purchasedTrainIds: [] }
        const funding = new EmergencyTrainFunding(
            state,
            TrainFundingRules1822,
            StockRules1822,
            TrainRules1822
        )
        const [purchase] = funding.purchases()
        expect(purchase).toMatchObject({ definitionId: '4', price: 300 })
        state.trainFunding = funding.begin(purchase)
        state.activePlayerIds = [first]
        const next = funding.next()
        // £140 in the treasury and £20 in hand leave £140 to borrow, the director's 20% being the
        // director's certificate, which is not sold.
        expect(next).toMatchObject({ kind: 'contribute', amount: 160, borrowed: 140 })
        TrainFundingRules1822.recordLoan?.(state, player(first), 140)
        expect(playerLoan1822(state, first)).toBe(210)
    })
})

describe('issuing and redeeming (§5.20)', () => {
    it('pays an issue at the value the shares come to rest at (§5.20.2)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 4, cash: 500 })
            state.machineState = 'BuyingTrains'
            state.operatingSet = {
                number: 1,
                roundNumber: 1,
                roundCount: 2,
                companyOrder: ['CR'],
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
            }
        })
        const choices = corporateFinanceChoices(game.hydrated, CorporateFinanceRules1822)
        expect(
            choices.find((choice) => choice.operation === 'issue' && choice.shares === 3)
        ).toMatchObject({
            amount: 210
        })
        // No more than half the company may be in the bank pool (§5.20.1).
        expect(
            Math.max(
                ...choices
                    .filter((choice) => choice.operation === 'issue')
                    .map((choice) => choice.shares)
            )
        ).toBe(5)
    })
})

describe('income (§3.1, §3.2.4)', () => {
    it('pays a concession £10 and P15 £10 for each phase number', () => {
        const game = prepared((state, [first]) => {
            giveCharter(state, concessionId('GWR'), player(first))
            giveCharter(state, 'P15', player(first))
        })
        expect(privateIncome1822(game.state, concessionId('GWR'))).toBe(10)
        expect(privateIncome1822(game.state, 'P15')).toBe(10)
        expect(privateIncome1822({ ...game.state, phaseId: '4' }, 'P15')).toBe(40)
    })
})

describe('the end of the game (§1.3)', () => {
    it('ends after the operating round in which a share value reaches the game end value', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M4', first)
            placeStockMarker(state.stockMarket, 'M4', EndGameSpaceId1822)
            state.operatingSet = {
                number: 4,
                roundNumber: 1,
                roundCount: 2,
                companyOrder: ['M4'],
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
            }
        })
        expect(EndingRules1822.trigger(game.hydrated)).toMatchObject({
            finalOperatingSet: 4,
            finalOperatingRound: 1
        })
    })

    it('ends after the first operating round following a stock round in which the bank broke', () => {
        const game = prepared((state) => {
            state.bank = { broken: true }
        })
        expect(EndingRules1822.trigger(game.hydrated)).toMatchObject({
            reason: 'Bank broken',
            finalOperatingSet: 1,
            finalOperatingRound: 1
        })
    })

    it('counts stock at its value, concessions at £100, privates at nothing and loans against (§1.3.2)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M4', first, { price: 80 })
            giveCharter(state, concessionId('GWR'), player(first))
            giveCharter(state, 'P2', player(first))
            state.playerLoans = [{ playerId: first, amount: 60 }]
        })
        const [first] = game.state.turnManager.turnOrder
        const wealth = finalWealth(game.hydrated, EndingRules1822).find(
            (entry) => entry.playerId === first
        )
        expect(wealth?.total).toBe(525 + 160 + 100 - 60)
    })
})

describe('stations (§5.12)', () => {
    it('stands a destination token beside a city whose one space waits for another home (§5.11.8)', () => {
        const york = major1822('NER')?.home
        if (!york) throw new Error('The North Eastern starts in York')
        const waiting = prepared((state, [first]) =>
            kit.operated(state, 'MR', first, { price: 100, shares: 6 })
        )
        // York's one space is kept for the North Eastern, so the Midland's token stands beside it.
        expect(tokenSpace1822(waiting.hydrated, 'MR', york)).toBe(1)
        expect(tokenSpace1822(waiting.hydrated, 'NER', york)).toBe(0)
        const settled = prepared((state, [first, second]) => {
            kit.operated(state, 'MR', first, { price: 100, shares: 6 })
            kit.operated(state, 'NER', second, { price: 100, shares: 6 })
        })
        expect(tokenSpace1822(settled.hydrated, 'MR', york)).toBe(1)
    })

    it('makes a company’s station already in its destination city its destination station, moving nothing (§5.12.6, §5.12.8)', () => {
        const york = major1822('MR')?.destination
        if (!york) throw new Error('The Midland’s destination is York')
        const game = prepared((state, [first, second]) => {
            kit.operated(state, 'MR', first, { price: 100, shares: 6 })
            kit.operated(state, 'NER', second, { price: 100, shares: 6 })
        })
        const state = game.hydrated
        const spare = state.stations.find(
            (station) => station.companyId === 'MR' && station.status === 'available'
        )
        if (!spare) throw new Error('The Midland has a spare station')
        state.stations = state.stations.map((station) =>
            station === spare
                ? {
                      id: spare.id,
                      companyId: 'MR',
                      status: 'placed',
                      position: { ...york, slot: 1 }
                  }
                : station
        )
        const placed = placeDestinationToken1822(state, 'MR', york)
        expect(placed).toMatchObject({ slot: 1, stationId: spare.id })
        expect(state.stations.find((station) => station.id === destinationStationId('MR'))).toEqual(
            {
                id: destinationStationId('MR'),
                companyId: 'MR',
                status: 'placed',
                position: { ...york, slot: 1 }
            }
        )
        // The destination token never comes onto the map, and the Midland has one station in York.
        expect(state.stations.find((station) => station.id === spare.id)).toBeUndefined()
        expect(
            state.stations.filter(
                (station) =>
                    station.companyId === 'MR' &&
                    station.status === 'placed' &&
                    station.position.locationId === york.locationId
            )
        ).toHaveLength(1)
    })

    it('leaves the Metropolitan Railway beside its station when London is upgraded (§5.10.3)', () => {
        const beside = minor1822('M16')?.home
        if (!beside) throw new Error('M16 starts in London')
        const game = prepared((state, [first, second]) => {
            runMinor(state, 'M15', first)
            runMinor(state, MetropolitanId, second)
            state.stations = state.stations.map((station) =>
                station.id === homeStationId(MetropolitanId)
                    ? {
                          id: station.id,
                          companyId: MetropolitanId,
                          status: 'placed',
                          position: { ...beside, slot: 1 }
                      }
                    : station
            )
        })
        const state = game.hydrated
        state.trackStep = { companyId: 'M15', lays: [], completed: false }
        const [yellow] = LondonTileIds1822
        const construction = new TrackConstruction(state, TrackRules1822)
        const lay = construction.evaluate({
            companyId: 'M15',
            locationId: LondonLocationId,
            definitionId: yellow,
            rotation: 0,
            nodeMapping: Object.fromEntries(LondonNodeIds.map((id) => [id, id]))
        })
        expect(lay.reason).toBeUndefined()
        // M16 has yet to place its home in the station's one space, which stays free for it.
        expect(lay.details?.movedStations).toEqual([])
    })

    it('lets a company with a London station take another of London’s, left free by a minor (§5.12.6)', () => {
        const game = prepared((state, [first]) => {
            kit.operated(state, 'GWR', first, { price: 100, shares: 6 })
            state.stationReservations = state.stationReservations.filter(
                (reservation) => reservation.companyId !== 'M15'
            )
        })
        const state = game.hydrated
        state.stationStep = { companyId: 'GWR', placedStationIds: [], completed: false }
        const placement = new StationPlacement(state, StationRules1822)
        const home = major1822('GWR')?.home
        const freed = minor1822('M15')?.home
        if (!home || !freed) throw new Error('GWR and M15 start in London')
        expect(home.locationId).toBe(freed.locationId)
        expect(placement.openSlots('GWR', home.locationId, home.nodeId)).toEqual([])
        expect(placement.openSlots('GWR', freed.locationId, freed.nodeId)).toEqual([0])
    })
})

describe('routes (§5.4, §5.5)', () => {
    function running(game: Table, companyId: string) {
        const state = game.hydrated
        state.routeStep = { companyId }
        return { state, evaluation: new RouteEvaluation(state, RouteRules1822) }
    }

    it('runs the Swansea and Mumbles’ L train for £30 on its printed track, and £20 once the hex is tiled (§5.8.4)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M24', first)
            kit.giveTrain(state, 'M24', 'L')
        })
        const { state, evaluation } = running(game, 'M24')
        const [train] = state.trainInventory.trains.filter((entry) => entry.status === 'owned')
        const face = RouteRules1822.map.location('D35').preprintedTile
        const printed = evaluation.evaluate('M24', [
            {
                trainId: train.id,
                start: { locationId: 'D35', nodeId: 'city' },
                paths: [{ locationId: 'D35', pathId: face.paths[0].id }]
            }
        ])
        expect(printed.result?.revenue).toBe(30)
        const tiled = prepared((next, [first]) => {
            runMinor(next, 'M24', first)
            kit.giveTrain(next, 'M24', 'L')
            layTiles(next, [{ locationId: 'D35', definitionId: '18xx:57', rotation: 0 }])
        })
        const alone = running(tiled, 'M24')
        const [local] = alone.state.trainInventory.trains.filter(
            (entry) => entry.status === 'owned'
        )
        expect(
            alone.evaluation.evaluate('M24', [
                { trainId: local.id, start: { locationId: 'D35', nodeId: 'city' }, paths: [] }
            ]).result?.revenue
        ).toBe(20)
    })

    it('takes no run of the English Channel and France alone, the two being one stop (§5.4.6)', () => {
        const [channelTileId] = EnglishChannelTileIds1822
        const game = prepared((state, [first]) => {
            state.phaseId = '5'
            kit.operated(state, 'SECR', first, { price: 100, shares: 6 })
            kit.giveTrain(state, 'SECR', '5')
            kit.operated(state, 'LBSCR', first, { price: 100, shares: 6 })
            kit.giveTrain(state, 'LBSCR', '5')
            layTiles(state, [
                { locationId: EnglishChannelLocationId, definitionId: channelTileId, rotation: 0 }
            ])
            const spare = state.stations.find(
                (station) => station.companyId === 'SECR' && station.status !== 'placed'
            )
            if (!spare) throw new Error('SECR has no spare station')
            state.stations = state.stations.map((station) =>
                station === spare
                    ? {
                          id: spare.id,
                          companyId: 'SECR',
                          status: 'placed',
                          position: {
                              locationId: EnglishChannelLocationId,
                              nodeId: 'city',
                              slot: 0
                          }
                      }
                    : station
            )
        })
        const { state, evaluation } = running(game, 'SECR')
        const [train] = state.trainInventory.trains.filter(
            (entry) => entry.status === 'owned' && entry.owner.companyId === 'SECR'
        )
        const toFrance = evaluation.network.mapState
            .tile(EnglishChannelLocationId)
            .face.paths.find((path) =>
                path.endpoints.some((end) => end.kind === 'edge' && end.edge === 5)
            )
        const [inFrance] = RouteRules1822.map.location(FranceLocationId).preprintedTile.paths
        if (!toFrance) throw new Error('The Channel has no track to France')
        expect(
            evaluation.evaluate('SECR', [
                {
                    trainId: train.id,
                    start: { locationId: EnglishChannelLocationId, nodeId: 'city' },
                    paths: [
                        { locationId: EnglishChannelLocationId, pathId: toFrance.id },
                        { locationId: FranceLocationId, pathId: inFrance.id }
                    ]
                }
            ]).reason
        ).toBe('A route must visit at least 2 cities or towns.')
        // A company tokened out of the Channel cannot run to it either (BGG article 32242130).
        const channel = { locationId: EnglishChannelLocationId, nodeId: 'city' }
        expect(RouteRules1822.stopAllowed?.(state, 'SECR', channel)).toBe(true)
        expect(RouteRules1822.stopAllowed?.(state, 'LBSCR', channel)).toBe(false)
        const blocked = running(game, 'LBSCR')
        const [lbscrTrain] = blocked.state.trainInventory.trains.filter(
            (entry) => entry.status === 'owned' && entry.owner.companyId === 'LBSCR'
        )
        expect(
            blocked.evaluation.evaluate('LBSCR', [
                {
                    trainId: lbscrTrain.id,
                    start: channel,
                    paths: [
                        { locationId: EnglishChannelLocationId, pathId: toFrance.id },
                        { locationId: FranceLocationId, pathId: inFrance.id }
                    ]
                }
            ]).reason
        ).toBe('This company may not use that revenue center.')
    })

    it('ends a route that crosses between Merthyr Tydfil and Pontypool (§5.4.7)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M21', first)
            kit.giveTrain(state, 'M21', '2')
        })
        const { state, evaluation } = running(game, 'M21')
        const [train] = state.trainInventory.trains.filter((entry) => entry.status === 'owned')
        const route = kit.route(state, train.id, { locationId: 'E34', nodeId: 'city' }, ['F33'])
        const result = evaluation.evaluate('M21', [route]).result
        // Phase 1 values: Merthyr Tydfil £30 and Pontypool £20 (§5.4.5).
        expect(result?.revenue).toBe(50)
        expect(evaluation.network.extensions(route.start, route.paths)).toEqual([])
    })

    it('runs across the Merthyr Tydfil–Pontypool link only from a station on its near side (§5.4.7)', () => {
        const runFrom = (minorId: string) => {
            const game = prepared((state, [first]) => {
                runMinor(state, minorId, first)
                kit.giveTrain(state, minorId, '3')
            })
            const { state, evaluation } = running(game, minorId)
            const [train] = state.trainInventory.trains.filter((entry) => entry.status === 'owned')
            const cardiff = { locationId: 'F35', nodeId: 'city' }
            const route = kit.route(state, train.id, cardiff, ['F35', 'E34', 'F33'])
            return evaluation.evaluate(minorId, [route])
        }
        // Phase 1 values: Cardiff £30, Merthyr Tydfil £30 and Pontypool £20 (§5.4.5).
        expect(runFrom('M21').result?.revenue).toBe(80)
        expect(runFrom('M20').reason).toBe(
            'A route runs on along terminus track only after a station of this company.'
        )
    })

    it('has an E train stop only at its company’s stations, doubled (§5.5.8)', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first))
        const state = game.hydrated
        const electric = RouteRules1822.depot.trainDefinition('E')
        const three = RouteRules1822.depot.trainDefinition('3')
        const home = { locationId: 'E6', nodeId: 'city' }
        const other = { locationId: 'H5', nodeId: 'city' }
        expect(RouteRules1822.stopsAt?.(state, 'CR', home, electric)).toBe(true)
        expect(RouteRules1822.stopsAt?.(state, 'CR', other, electric)).toBe(false)
        expect(RouteRules1822.stopsAt?.(state, 'CR', other, three)).toBe(true)
        expect(RouteRules1822.stopRevenue?.(state, 'CR', home, 40, electric)).toBe(80)
        expect(RouteRules1822.stopRevenue?.(state, 'CR', home, 40, three)).toBe(40)
    })

    it('lets a Pullman make a train count large stations only, though never an E or L train (§5.5.6)', () => {
        const game = prepared(() => undefined)
        const state = game.hydrated
        const pullman = RouteRules1822.depot.trainDefinition('P+')
        const three = RouteRules1822.attachedDefinition?.(
            state,
            RouteRules1822.depot.trainDefinition('3'),
            [pullman]
        )
        expect(three).toMatchObject({
            name: '3+',
            distance: { measure: 'cities-and-offboards', maximum: 3 }
        })
        for (const trainId of ['E', 'L', 'LP'])
            expect(
                typeof RouteRules1822.attachedDefinition?.(
                    state,
                    RouteRules1822.depot.trainDefinition(trainId),
                    [pullman]
                )
            ).toBe('string')
    })
})
