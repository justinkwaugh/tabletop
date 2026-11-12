import { describe, expect, it } from 'vitest'
import {
    cashOwnedBy,
    corporateFinanceChoices,
    finalWealth,
    getCompany,
    isStartCompany,
    placeStockMarker,
    sharesOwned,
    treasuryPoolId
} from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import {
    GaribaldiHomeLocationIds,
    GaribaldiId,
    TokenFees1849,
    lastCertificateId
} from './companies.js'
import { Map1849, MessinaLocationId } from './map.js'
import {
    CorporateFinanceRules1849,
    EarningsRules1849,
    EndingRules1849,
    PhaseRules1849,
    closeCorporation1849,
    stalemate1849
} from './operating.js'
import {
    CompanyRules1849,
    StockRules1849,
    nextCorporation1849,
    reviewGaribaldi1849,
    startOrder1849
} from './stock.js'
import { Market1849 } from './stockMarket.js'
import { messinaLocked, terrainCost1849 } from './track.js'

const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const spaceOf = (price: number, row?: number) => {
    const space = Market1849.spaces.find(
        (entry) => entry.price === price && (row === undefined || entry.row === row)
    )
    if (!space) throw new Error(`No ${price} space`)
    return space.id
}

/** A four-player table in its first stock round, the privates sold. */
function stockRound(): Table {
    const game = kit.table(4, 11)
    kit.buyAllPrivates(game)
    expect(game.state.machineState).toBe('StockRound')
    return game
}

/** Starts the next corporation at a price with further certificates. */
function startNext(game: Table, price: number, extra = 0) {
    const companyId = nextCorporation1849(game.hydrated)
    if (!companyId) throw new Error('No corporation to start')
    const extras = game.state.certificates
        .filter(
            (certificate) =>
                certificate.companyId === companyId &&
                certificate.kind === 'share' &&
                certificate.shares === 1 &&
                !certificate.president
        )
        .slice(0, extra)
        .map((certificate) => certificate.id)
    const home = CompanyRules1849.startHomes?.(game.hydrated, companyId, spaceOf(price))?.[0]
    game.act('StartCompany', {
        buyer: player(game.player),
        companyId,
        marketSpaceId: spaceOf(price, price === 68 ? 4 : price === 100 ? 3 : undefined),
        expectedPrice: price * 2,
        ...(home ? { home: { locationId: home.locationId, nodeId: home.nodeId } } : {}),
        ...(extras.length ? { additionalCertificateIds: extras } : {})
    })
    return companyId
}

describe('starting corporations (§9.4)', () => {
    it('starts only the next corporation in order, its president taking up to 40%', () => {
        const game = stockRound()
        const president = game.player
        const next = nextCorporation1849(game.hydrated)
        const later = game.state.corporationOrder.find(
            (id) => id !== next && !getCompany(game.state, id).started
        )
        expect(CompanyRules1849.startMarketSpaces(game.hydrated, later ?? '')).toEqual([])
        const companyId = startNext(game, 68, 2)
        expect(sharesOwned(game.state, companyId, player(president))).toBe(4)
        const company = getCompany(game.state, companyId)
        expect(company.floated).toBe(true)
        // L. 272 paid in, less the token fee; the home station placed.
        expect(cashOwnedBy(game.state, { kind: 'company', companyId })).toBe(
            272 - TokenFees1849[companyId]
        )
        expect(
            game.state.stations.some(
                (station) => station.companyId === companyId && station.status === 'placed'
            )
        ).toBe(true)
    })

    it('refuses a third further certificate', () => {
        const game = stockRound()
        expect(() => startNext(game, 68, 3)).toThrow()
    })
})

describe('the Garibaldi without room (§9.4.1)', () => {
    /** A first stock round in which the Garibaldi did not come with the RSA. */
    function unstartedGaribaldi(): Table {
        for (let seed = 1; seed < 40; seed++) {
            const game = kit.table(4, seed)
            if (game.state.corporationOrder[0] === GaribaldiId) continue
            kit.buyAllPrivates(game)
            return game
        }
        throw new Error('No seed leaves the Garibaldi unstarted')
    }

    /** Fills every space in the Garibaldi's cities with other corporations' stations. */
    function fillGaribaldiCities(game: Table) {
        const state = game.hydrated
        const others = state.corporationOrder.filter((id) => id !== GaribaldiId)
        const freed: string[] = []
        for (const locationId of GaribaldiHomeLocationIds) {
            const city = Map1849.location(locationId).preprintedTile.nodes.find(
                (node) => node.kind === 'city'
            )
            if (!city || city.kind !== 'city') throw new Error(`No city at ${locationId}`)
            for (let slot = 0; slot < city.stationSlots; slot++) {
                const companyId = others[freed.length % others.length]
                const station = state.stations.find(
                    (entry) => entry.companyId === companyId && entry.status === 'available'
                )
                if (!station) throw new Error(`No station for ${companyId}`)
                state.stations = state.stations.map((entry) =>
                    entry.id === station.id
                        ? {
                              id: entry.id,
                              companyId,
                              status: 'placed',
                              position: { locationId, nodeId: city.id, slot }
                          }
                        : entry
                )
                freed.push(station.id)
            }
        }
        return { state, stationIds: freed }
    }

    it('is passed over and shown last at once, set aside as a stock round begins', () => {
        const game = unstartedGaribaldi()
        const { state } = fillGaribaldiCities(game)
        expect(startOrder1849(state).at(-1)).toBe(GaribaldiId)
        expect(nextCorporation1849(state)).not.toBe(GaribaldiId)
        reviewGaribaldi1849(state)
        expect(state.garibaldiAside).toBe(true)
        expect(state.corporationOrder.at(-1)).toBe(GaribaldiId)
    })

    it('comes back only when a stock round begins with room in one of its cities', () => {
        const game = unstartedGaribaldi()
        const { state, stationIds } = fillGaribaldiCities(game)
        reviewGaribaldi1849(state)
        // Room opens during the round: the Garibaldi waits for the next.
        state.stations = state.stations.map((entry) =>
            entry.id === stationIds[0]
                ? { id: entry.id, companyId: entry.companyId, status: 'available' }
                : entry
        )
        expect(nextCorporation1849(state)).not.toBe(GaribaldiId)
        reviewGaribaldi1849(state)
        expect(state.garibaldiAside).toBeUndefined()
        expect(state.corporationOrder.at(-1)).toBe(GaribaldiId)
        // With every other corporation started, the Garibaldi is next.
        for (const company of state.companies)
            if (company.id !== GaribaldiId) company.started = true
        expect(nextCorporation1849(state)).toBe(GaribaldiId)
    })

    it('pays its fee with the home it chooses, recorded with the start', () => {
        for (let seed = 1; seed < 40; seed++) {
            const game = kit.table(4, seed)
            if (game.state.corporationOrder[1] !== GaribaldiId) continue
            kit.buyAllPrivates(game)
            expect(startNext(game, 68)).toBe(GaribaldiId)
            const start = game.actions.findLast(isStartCompany)
            expect(start?.metadata?.home?.cost).toBe(TokenFees1849[GaribaldiId])
            expect(cashOwnedBy(game.state, { kind: 'company', companyId: GaribaldiId })).toBe(
                136 - TokenFees1849[GaribaldiId]
            )
            return
        }
        throw new Error('No seed puts the Garibaldi second')
    })

    it('stays behind a corporation that closes while it is set aside (§11)', () => {
        const game = unstartedGaribaldi()
        const companyId = startNext(game, 68)
        const { state } = fillGaribaldiCities(game)
        reviewGaribaldi1849(state)
        closeCorporation1849(state, companyId)
        expect(state.corporationOrder.slice(-2)).toEqual([companyId, GaribaldiId])
    })
})

describe('the last certificate (§9.3, §9.6)', () => {
    it('is bought only when no other certificate is left in its place, for twice the price', () => {
        const game = stockRound()
        const companyId = startNext(game, 100)
        const last = game.state.certificates.find(
            (certificate) => certificate.id === lastCertificateId(companyId)
        )
        if (!last || last.kind !== 'share') throw new Error('No last certificate')
        expect(typeof StockRules1849.purchaseTerms(game.hydrated, last, player('p1'))).toBe(
            'string'
        )
        for (const certificate of game.state.certificates)
            if (
                certificate.companyId === companyId &&
                certificate.kind === 'share' &&
                certificate.shares === 1
            ) {
                certificate.owner = player('p2')
                delete certificate.poolId
            }
        const terms = StockRules1849.purchaseTerms(game.hydrated, last, player('p1'))
        expect(typeof terms === 'string' ? terms : terms.price).toBe(200)
    })
})

describe('share price moves (§5, §9.7, §10.5.3)', () => {
    const effect = (game: Table, choice: 'pay' | 'withhold', revenue: number) =>
        EarningsRules1849.marketEffect(game.hydrated, 'X', {
            choice,
            revenue,
            retained: 0,
            baseDividendPerShare: revenue / 10
        })

    function at(price: number, row: number, phaseId = '4H') {
        const game = stockRound()
        const companyId = startNext(game, 100)
        placeStockMarker(game.state.stockMarket, companyId, spaceOf(price, row))
        game.state.phaseId = phaseId
        return {
            game,
            move: (choice: 'pay' | 'withhold', revenue: number) => {
                const result = EarningsRules1849.marketEffect(game.hydrated, companyId, {
                    choice,
                    revenue,
                    retained: 0,
                    baseDividendPerShare: revenue / 10
                })
                return result.move ? Market1849.space(result.move.toMarketSpaceId).price : price
            },
            companyId
        }
    }

    it('moves right on a dividend of at least the price, not on less, and left on withholding', () => {
        const { move } = at(100, 3)
        expect(move('pay', 100)).toBe(111)
        expect(move('pay', 90)).toBe(100)
        expect(move('withhold', 100)).toBe(90)
        expect(move('pay', 0)).toBe(90)
        void effect
    })

    it('meets the blue zone as the right edge before phase 16, going up', () => {
        expect(at(218, 2).move('pay', 300)).toBe(240)
        expect(at(276, 0).move('pay', 300)).toBe(276)
        expect(at(218, 2, '16H').move('pay', 300)).toBe(242)
    })

    it('keeps a sold-out price at L. 230 out of the blue zone until phase 16', () => {
        const before = at(230, 3)
        expect(StockRules1849.round.soldOutRises?.(before.game.hydrated, before.companyId)).toBe(0)
        const after = at(230, 3, '16H')
        expect(StockRules1849.round.soldOutRises?.(after.game.hydrated, after.companyId)).toBe(1)
    })
})

describe('closure (§11)', () => {
    it('returns the charter to start again from the next stock round, last in order', () => {
        const game = stockRound()
        const companyId = startNext(game, 68)
        const round = game.state.stockRound.number
        const state = game.hydrated
        closeCorporation1849(state, companyId)
        const company = getCompany(state, companyId)
        expect(company.started).toBeFalsy()
        expect(company.closed).toBeFalsy()
        expect(state.corporationOrder.at(-1)).toBe(companyId)
        expect(state.restarts).toContainEqual({ companyId, stockRound: round + 1 })
        expect(
            state.certificates.filter((certificate) => certificate.companyId === companyId)
        ).toHaveLength(8)
        expect(
            state.certificates.every(
                (certificate) =>
                    certificate.companyId !== companyId ||
                    certificate.poolId === treasuryPoolId(companyId)
            )
        ).toBe(true)
        expect(nextCorporation1849(state)).not.toBe(companyId)
    })
})

describe('financial activities (§10.8)', () => {
    it('sells single certificates before the last, never splitting it, and redeems one', () => {
        const game = stockRound()
        const companyId = startNext(game, 100)
        const state = game.hydrated
        // Leave two single certificates and the last in the treasury.
        let kept = 0
        for (const certificate of state.certificates)
            if (
                certificate.companyId === companyId &&
                certificate.kind === 'share' &&
                certificate.shares === 1 &&
                certificate.poolId === treasuryPoolId(companyId)
            ) {
                if (kept < 2) kept++
                else {
                    certificate.owner = player('p3')
                    delete certificate.poolId
                }
            }
        state.machineState = 'BuyingTrains'
        state.operatingSet = {
            number: 9,
            roundNumber: 1,
            roundCount: 1,
            companyOrder: [companyId],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        state.trainInventory.trains = state.trainInventory.trains.map((train, index) =>
            index === 0
                ? { ...train, status: 'owned', owner: { kind: 'company', companyId } }
                : train
        )
        const shares = corporateFinanceChoices(state, CorporateFinanceRules1849)
            .filter((choice) => choice.operation === 'issue')
            .map((choice) => choice.shares)
        expect(shares).toEqual([1, 2, 4])
    })
})

describe('the Messina earthquake (§12)', () => {
    it('removes Messina’s tile and tokens and locks it until after the next stock round', () => {
        const game = stockRound()
        const state = game.hydrated
        state.tileInventory.placements[MessinaLocationId] = {
            pieceId: 'test-piece',
            definitionId: '1849:655',
            rotation: 0
        }
        const companyId = startNext(game, 68)
        const station = game.hydrated.stations.find(
            (entry) => entry.companyId === companyId && entry.status === 'available'
        )
        const shaken = game.hydrated
        shaken.tileInventory.placements[MessinaLocationId] = {
            pieceId: 'test-piece',
            definitionId: '1849:655',
            rotation: 0
        }
        if (!station) throw new Error('No station')
        shaken.stations = shaken.stations.map((entry) =>
            entry.id === station.id
                ? {
                      id: entry.id,
                      companyId,
                      status: 'placed',
                      position: { locationId: MessinaLocationId, nodeId: 'city', slot: 0 }
                  }
                : entry
        )
        shaken.phaseId = '12H'
        const changes = PhaseRules1849.changes?.apply(shaken, {
            id: 'phase:test',
            trainId: 'test',
            definitionId: '12H',
            fromPhaseId: '10H',
            toPhaseId: '12H'
        })
        expect(changes).toMatchObject({ lostStationIds: [station.id] })
        expect(shaken.tileInventory.placements[MessinaLocationId]).toBeUndefined()
        expect(shaken.stations.find((entry) => entry.id === station.id)?.status).toBe('removed')
        expect(messinaLocked(shaken)).toBe(true)
        shaken.stockRound = { ...shaken.stockRound, number: shaken.stockRound.number + 1 }
        expect(messinaLocked(shaken)).toBe(true)
        shaken.stockRound = { ...shaken.stockRound, completed: true }
        expect(messinaLocked(shaken)).toBe(false)
    })
})

describe('terrain (§10.3.1)', () => {
    it('costs a quarter for narrow gauge only, full otherwise', () => {
        const game = stockRound()
        const state = game.hydrated
        // K9 holds narrow track on a L. 160 mountain; a narrow upgrade adds only narrow track.
        const request = (definitionId: string, locationId = 'D2') => ({
            companyId: 'X',
            locationId,
            definitionId,
            rotation: 0 as const,
            nodeMapping: {}
        })
        expect(terrainCost1849(state, request('1849:78'))).toBe(40)
        expect(terrainCost1849(state, request('18xx:8'))).toBe(160)
    })
})

describe('the end (§13)', () => {
    it('comes once a corporation at L. 377 has finished operating', () => {
        const game = stockRound()
        const companyId = startNext(game, 100)
        const state = game.hydrated
        placeStockMarker(state.stockMarket, companyId, spaceOf(377))
        state.machineState = 'OperatingSet'
        state.operatingSet = {
            number: 3,
            roundNumber: 1,
            roundCount: 2,
            companyOrder: [companyId],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        expect(EndingRules1849.trigger(state)).toBeUndefined()
        state.operatingSet.completedCompanyIds = [companyId]
        expect(EndingRules1849.trigger(state)).toEqual({ reason: 'L. 377 share price' })
    })

    it('comes when no corporation is open, no private earns and no one can afford a start', () => {
        const game = stockRound()
        const state = game.hydrated
        expect(stalemate1849(state)).toBe(false)
        for (const company of state.companies)
            if (company.kind === 'private') company.closed = true
            else company.started = false
        // The lowest start in phase 4 is two shares at L. 68.
        for (const cash of state.cash) if (cash.owner.kind === 'player') cash.amount = 135
        expect(stalemate1849(state)).toBe(true)
        expect(EndingRules1849.trigger(state)).toEqual({ reason: 'No corporation can start' })
        const rich = state.cash.find((cash) => cash.owner.kind === 'player')
        if (!rich) throw new Error('No player cash')
        rich.amount = 136
        expect(stalemate1849(state)).toBe(false)
    })

    it('takes L. 750 a loan off a player’s total, to no less than nothing', () => {
        const game = stockRound()
        const state = game.hydrated
        state.loans = [{ playerId: 'p1', count: 1 }]
        const wealth = finalWealth(state, EndingRules1849)
        const p1 = wealth.find((entry) => entry.playerId === 'p1')
        expect(p1?.total).toBe(0)
        expect(p1?.items.at(-1)?.value).toBeLessThan(0)
    })
})
