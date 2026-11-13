import { describe, expect, it } from 'vitest'
import {
    accessRightsLeft,
    cashOwnedBy,
    holdsAccessRight,
    crisisSales,
    evaluateCrisisSale,
    corporateFinanceChoices,
    finalWealth,
    canTakeLoan,
    getCompany,
    homeStationId,
    isStartCompany,
    purchaseChoices,
    stretchWeight,
    placeStockMarker,
    sharesOwned,
    takeLoanReason,
    trainsOwnedBy,
    treasuryPoolId
} from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import { BondValue1849, LoanRules1849 } from './bonds.js'
import { stationPurchaseReason1849 } from './stationPurchase.js'
import { AccessRightRules1849, ETokenId, eTokenPrice1849 } from './electricDreams.js'
import { RouteRules1849 } from './routes.js'
import { ElectricTrainId, TrainDepot1849 } from './trains.js'
import { botMove, Random } from '../test/bot.js'
import {
    GaribaldiHomeLocationIds,
    GaribaldiId,
    TokenFees1849,
    lastCertificateId
} from './companies.js'
import { Map1849, MessinaLocationId } from './map.js'
import {
    CashCrisisRules1849,
    CorporateFinanceRules1849,
    EarningsRules1849,
    EndingRules1849,
    PhaseRules1849,
    TrainRules1849,
    TransferRules1849,
    InsolvencyChoices1849,
    ZeroPriceClosure1849,
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

describe('a change of president (§9.5)', () => {
    /** A newcomer about to overtake a 30% president, holding the last certificate and a single. */
    function overtaking() {
        const game = stockRound()
        const outgoing = game.player
        const companyId = startNext(game, 68, 1)
        game.act('FinishStockTurn')
        const newcomer = game.player
        const offered = () =>
            game.state.certificates.filter(
                (certificate) =>
                    certificate.companyId === companyId &&
                    certificate.kind === 'share' &&
                    certificate.shares === 1 &&
                    certificate.owner.kind === 'company'
            )
        for (const id of [lastCertificateId(companyId), offered()[0]?.id]) {
            const certificate = game.state.certificates.find((entry) => entry.id === id)
            if (!certificate) throw new Error('No certificate to hand the newcomer')
            certificate.owner = player(newcomer)
            delete certificate.poolId
        }
        const [single] = offered()
        if (!single) throw new Error('No single certificate on offer')
        game.act('BuyShares', {
            buyer: player(newcomer),
            certificateId: single.id,
            expectedPrice: 68
        })
        return { game, companyId, outgoing, newcomer }
    }
    const held = (game: Table, playerId: string, companyId: string) =>
        game.state.certificates
            .filter(
                (certificate) =>
                    certificate.companyId === companyId &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === playerId
            )
            .map((certificate) => (certificate.kind === 'share' ? certificate.shares : 0))
            .toSorted()

    it('waits for the outgoing president to choose, then carries on the newcomer’s turn', () => {
        const { game, companyId, outgoing, newcomer } = overtaking()
        expect(game.state.activePlayerIds).toEqual([outgoing])
        expect(game.valid(outgoing)).toEqual(['ChoosePresidencyExchange'])
        expect(game.valid(newcomer)).toEqual([])
        // Until they choose, the last certificate is theirs.
        expect(held(game, outgoing, companyId)).toEqual([1, 2])
        const [pending] = game.state.presidencyExchanges ?? []
        const singles = pending?.alternatives?.[0]
        if (!singles) throw new Error('Two single certificates are offered')
        game.act('ChoosePresidencyExchange', { companyId, certificateIds: singles }, outgoing)
        expect(held(game, outgoing, companyId)).toEqual([1, 1, 1])
        expect(held(game, newcomer, companyId)).toEqual([2, 2])
        expect(game.state.presidencyExchanges).toBeUndefined()
        // The newcomer's turn then carries on: with nothing left to do, it finishes.
        expect(game.actions.at(-1)).toMatchObject({ type: 'FinishStockTurn', playerId: newcomer })
    })

    it('lets the outgoing president keep the last certificate', () => {
        const { game, companyId, outgoing, newcomer } = overtaking()
        game.act(
            'ChoosePresidencyExchange',
            { companyId, certificateIds: [lastCertificateId(companyId)] },
            outgoing
        )
        expect(held(game, outgoing, companyId)).toEqual([1, 2])
        expect(held(game, newcomer, companyId)).toEqual([1, 1, 2])
        expect(game.actions.at(-1)).toMatchObject({ type: 'FinishStockTurn', playerId: newcomer })
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

describe('the Bonds variant (§14.2)', () => {
    /** A started corporation in a game with bonds, in phase 8. */
    function bonded() {
        const game = stockRound()
        const companyId = startNext(game, 100)
        const state = game.hydrated
        state.variants = { ...state.variants, bonds: true }
        state.phaseId = '8H'
        return { game, state, companyId }
    }
    const president = (state: Parameters<typeof getCompany>[0], companyId: string) => {
        const owner = getCompany(state, companyId).president
        if (owner?.kind !== 'player') throw new Error('A player presides')
        return owner.playerId
    }

    it('lets a corporation issue one bond from phase 8, only with the variant', () => {
        const { state, companyId } = bonded()
        expect(takeLoanReason(state, LoanRules1849, companyId)).toBeUndefined()
        state.phaseId = '6H'
        expect(takeLoanReason(state, LoanRules1849, companyId)).toBeDefined()
        state.phaseId = '8H'
        state.variants = { ...state.variants, bonds: undefined }
        expect(takeLoanReason(state, LoanRules1849, companyId)).toBe('Loans are not in this game.')
    })

    it('may issue its bond again once it has repaid it (§14.2)', () => {
        const { state, companyId } = bonded()
        const playerId = president(state, companyId)
        state.loanStep = { companyId }
        getCompany(state, companyId).loans = 1
        expect(canTakeLoan(state, LoanRules1849, playerId, companyId)).toBe(false)
        delete getCompany(state, companyId).loans
        expect(canTakeLoan(state, LoanRules1849, playerId, companyId)).toBe(true)
    })

    /**
     * A four-player game with bonds played on until a corporation with an issued bond and a
     * train is buying trains, its treasury then emptied and its president left `cash`, its
     * turn then finished so that its bond interest falls due.
     */
    function interestDue(cash: number, onlyPresidency = false) {
        const game = kit.table(4, 1, { bonds: true })
        const random = new Random(1)
        const companyOf = () => game.state.trainPurchaseStep?.companyId
        const ready = () => {
            const companyId = companyOf()
            return (
                game.state.machineState === 'BuyingTrains' &&
                !!companyId &&
                (getCompany(game.state, companyId).loans ?? 0) > 0 &&
                trainsOwnedBy(game.hydrated, { kind: 'company', companyId }).length > 0
            )
        }
        for (let count = 0; count < 20000 && !ready(); count++) {
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        const companyId = companyOf()
        if (!companyId || !ready()) throw new Error('No bond came due')
        const playerId = president(game.state, companyId)
        const bank = game.state.cash.find((entry) => entry.owner.kind === 'bank')
        if (!bank) throw new Error('No bank')
        for (const entry of game.state.cash) {
            const owner = entry.owner
            const drained =
                (owner.kind === 'company' && owner.companyId === companyId) ||
                (owner.kind === 'player' && owner.playerId === playerId)
            if (!drained) continue
            const keep = owner.kind === 'player' ? cash : 0
            bank.amount += entry.amount - keep
            entry.amount = keep
        }
        // Their other shares go to another player, leaving them only the presidency.
        if (onlyPresidency) {
            const other = game.state.players.find((entry) => entry.playerId !== playerId)
            if (!other) throw new Error('No other player')
            for (const certificate of game.state.certificates)
                if (
                    certificate.kind === 'share' &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === playerId &&
                    !(certificate.companyId === companyId && certificate.president)
                )
                    certificate.owner = { kind: 'player', playerId: other.playerId }
        }
        game.act(
            game.valid().includes('FinishTrains') ? 'FinishTrains' : 'FinishOperatingTurn',
            { companyId },
            playerId
        )
        return { game, companyId, playerId }
    }

    it('has the president pay interest the treasury cannot, then sell shares (§10.7)', () => {
        const { game, companyId, playerId } = interestDue(10)
        expect(game.state.machineState).toBe('RaisingCash')
        expect(game.state.cashCrisis?.debts).toEqual([{ playerId, amount: 40, companyId }])
        const state = game.hydrated
        const sales = crisisSales(state, CashCrisisRules1849, playerId)
        expect(sales.length).toBeGreaterThan(0)
        // No sale gives up the presidency of the corporation whose bond it is.
        for (const { sale } of sales) {
            const details = evaluateCrisisSale(state, CashCrisisRules1849, playerId, sale).details
            if (sale.companyId === companyId) expect(details?.sales[0]?.presidency).toBeUndefined()
        }
        const [first] = sales
        game.act(
            'SellSharesToPay',
            { sale: first.sale, expectedProceeds: first.proceeds },
            playerId
        )
        // The turn goes on past the bond step, its president left nothing to decide.
        expect(game.state.machineState).not.toBe('RaisingCash')
        expect(game.state.cashCrisis).toBeUndefined()
        expect(getCompany(game.state, companyId).started).toBe(true)
        expect(game.state.operatingSet?.completedCompanyIds).toContain(companyId)
    })

    it('closes the corporation when its president cannot raise the interest (§10.7)', () => {
        const { game, companyId, playerId } = interestDue(0, true)
        expect(game.state.machineState).toBe('RaisingCash')
        expect(game.valid(playerId)).toContain('GoBankrupt')
        expect(game.valid(playerId)).not.toContain('SellSharesToPay')
        game.act('GoBankrupt', { choice: InsolvencyChoices1849.loan }, playerId)
        expect(getCompany(game.state, companyId).started).toBeFalsy()
        expect(game.state.cashCrisis).toBeUndefined()
        expect(game.state.loans).toContainEqual({ playerId, count: 1 })
        expect(game.state.operatingSet?.completedCompanyIds).toContain(companyId)
    })

    it('leaves a closing corporation’s president owing what they cannot pay of its bond', () => {
        const { state, companyId } = bonded()
        const playerId = president(state, companyId)
        getCompany(state, companyId).loans = 1
        const bank = state.cash.find((cash) => cash.owner.kind === 'bank')
        if (!bank) throw new Error('No bank')
        for (const entry of state.cash) {
            const owner = entry.owner
            const keep =
                owner.kind === 'company' && owner.companyId === companyId
                    ? 100
                    : owner.kind === 'player' && owner.playerId === playerId
                      ? 50
                      : undefined
            if (keep === undefined) continue
            bank.amount += entry.amount - keep
            entry.amount = keep
        }
        const closure = closeCorporation1849(state, companyId)
        expect(closure.bondShortfall).toEqual({ playerId, amount: 350 })
        expect(ZeroPriceClosure1849.closure.debts?.(closure)).toEqual([
            { playerId, amount: 350, companyId }
        ])
    })

    it('repays an outstanding bond from the treasury as the corporation closes', () => {
        const { state, companyId } = bonded()
        getCompany(state, companyId).loans = 1
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
        )
        const bank = state.cash.find((cash) => cash.owner.kind === 'bank')
        if (!treasury || !bank) throw new Error('No treasury or bank')
        bank.amount -= 600 - treasury.amount
        treasury.amount = 600
        const closure = closeCorporation1849(state, companyId)
        expect(getCompany(state, companyId).loans).toBeUndefined()
        expect(closure.bondRepayment).toEqual([
            { from: { kind: 'company', companyId }, to: { kind: 'bank' }, amount: BondValue1849 }
        ])
    })

    it('counts each share L. 100 less at the end while the bond is outstanding', () => {
        const { state, companyId } = bonded()
        const certificate = state.certificates.find(
            (entry) => entry.companyId === companyId && entry.kind === 'share' && entry.president
        )
        if (!certificate) throw new Error('No president’s certificate')
        const [plain] = EndingRules1849.certificateItems(state, certificate)
        getCompany(state, companyId).loans = 1
        const [bonded_] = EndingRules1849.certificateItems(state, certificate)
        expect((plain?.value ?? 0) - (bonded_?.value ?? 0)).toBe(200)
    })
})

describe('the Buy station tokens variant (§14.1)', () => {
    /** A four-player game played on until a corporation may buy another's station. */
    function stationOnOffer() {
        const game = kit.table(4, 1, { buyStationTokens: true })
        const random = new Random(1)
        const offers = () =>
            purchaseChoices(game.hydrated, game.player, TransferRules1849, TrainRules1849).filter(
                (choice) => choice.request.asset.kind === 'station'
            )
        for (let count = 0; count < 6000; count++) {
            if (
                game.state.machineState === 'BuyingTrains' &&
                !game.state.purchaseOffer &&
                offers().length
            )
                break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        const [offer] = offers()
        if (!offer || offer.request.asset.kind !== 'station') throw new Error('No station offered')
        return { game, request: offer.request, stationId: offer.request.asset.stationId }
    }

    it('offers only other corporations’ stations it reaches, never a home token', () => {
        const { game, request } = stationOnOffer()
        const state = game.hydrated
        const buyer = request.companyId
        for (const station of state.stations) {
            const reason = stationPurchaseReason1849(state, buyer, station.id)
            if (station.id === homeStationId(station.companyId) && station.companyId !== buyer)
                expect(reason).toBeDefined()
            if (station.companyId === buyer) expect(reason).toBeDefined()
        }
        state.variants = { ...state.variants, buyStationTokens: undefined }
        expect(
            stationPurchaseReason1849(
                state,
                buyer,
                request.asset.kind === 'station' ? request.asset.stationId : ''
            )
        ).toBe('Station tokens are not bought in this game.')
    })

    it('swaps the tokens once the seller’s president agrees, once a turn', () => {
        const { game, request, stationId } = stationOnOffer()
        const sold = game.state.stations.find((entry) => entry.id === stationId)
        if (sold?.status !== 'placed') throw new Error('The station is placed')
        const buyerPlayer = game.player
        game.act('OfferPurchase', { ...request, price: 1 }, buyerPlayer)
        if (game.state.purchaseOffer)
            game.act(
                'RespondToPurchaseOffer',
                { offerId: game.state.purchaseOffer.id, accept: true },
                game.player
            )
        const after = game.state.stations
        expect(after.find((entry) => entry.id === stationId)?.status).toBe('available')
        expect(
            after.some(
                (entry) =>
                    entry.companyId === request.companyId &&
                    entry.status === 'placed' &&
                    entry.position.locationId === sold.position.locationId
            )
        ).toBe(true)
        for (const station of after)
            expect(
                stationPurchaseReason1849(game.hydrated, request.companyId, station.id)
            ).toBeDefined()
    })
})

describe('the Electric Dreams variant (§14.3)', () => {
    const eTrain = TrainDepot1849.trainDefinition(ElectricTrainId)
    const sixteen = TrainDepot1849.trainDefinition('16H')

    it('stocks E trains only in its games, on sale from the first 12H', () => {
        const count = (game: Table) =>
            game.state.trainInventory.trains.filter(
                (train) => train.definitionId === ElectricTrainId
            ).length
        expect(count(kit.table(4, 1))).toBe(0)
        expect(count(kit.table(4, 1, { fiveCorporations: true }))).toBe(0)
        const electric = kit.table(4, 1, { electricDreams: true })
        expect(count(electric)).toBe(6)
        expect(count(kit.table(4, 1, { electricDreams: true, fiveCorporations: true }))).toBe(6)
        // Electric Dreams brings the other variants with it.
        expect(electric.state.variants).toMatchObject({ bonds: true, buyStationTokens: true })
        const state = electric.hydrated
        expect(TrainRules1849.availableDefinitions?.(state)).not.toContain(ElectricTrainId)
        state.phaseId = '12H'
        expect(TrainRules1849.availableDefinitions?.(state)).toContain(ElectricTrainId)
    })

    it('sells an E train only to a corporation with an E token', () => {
        const state = kit.table(4, 1, { electricDreams: true }).hydrated
        expect(TrainRules1849.limitReason?.(state, 'RCS', ElectricTrainId)).toBe(
            'An E train needs an E token.'
        )
        state.accessRights = [{ rightId: ETokenId, companyId: 'RCS' }]
        expect(TrainRules1849.limitReason?.(state, 'RCS', ElectricTrainId)).toBeUndefined()
        expect(TrainRules1849.limitReason?.(state, 'IFT', '16H')).toBeUndefined()
    })

    it('prices E tokens by phase, the first dearer', () => {
        const state = { phaseId: '12H', accessRights: [] }
        expect(eTokenPrice1849(state)).toBe(1100)
        expect(eTokenPrice1849({ ...state, phaseId: '16H' })).toBe(800)
        const sold = { accessRights: [{ rightId: ETokenId, companyId: 'RCS' }] }
        expect(eTokenPrice1849({ ...sold, phaseId: '12H' })).toBe(800)
        expect(eTokenPrice1849({ ...sold, phaseId: '16H' })).toBe(550)
    })

    it('returns a closing corporation’s E token to the bank, at the later price (§11)', () => {
        const game = stockRound()
        const companyId = startNext(game, 100)
        const state = game.hydrated
        state.variants = { ...state.variants, electricDreams: true }
        state.phaseId = '12H'
        state.accessRights = [{ rightId: ETokenId, companyId }]
        const closure = closeCorporation1849(state, companyId)
        expect(closure.returnedEToken).toBe(true)
        expect(holdsAccessRight(state, companyId, ETokenId)).toBe(false)
        expect(accessRightsLeft(state, AccessRightRules1849, ETokenId)).toBe(6)
        expect(eTokenPrice1849(state)).toBe(800)
    })

    it('doubles the four great cities for E trains and keeps them off narrow gauge', () => {
        const state = kit.table(4, 1, { electricDreams: true }).hydrated
        const palermo = { locationId: 'C5', nodeId: 'city' }
        const trapani = { locationId: 'C1', nodeId: 'city' }
        expect(RouteRules1849.stopRevenue?.(state, 'RCS', palermo, 50, eTrain)).toBe(100)
        expect(RouteRules1849.stopRevenue?.(state, 'RCS', palermo, 50, sixteen)).toBe(50)
        expect(RouteRules1849.stopRevenue?.(state, 'RCS', trapani, 30, eTrain)).toBe(30)
        expect(stretchWeight(eTrain.distance, 'narrow')).toBeGreaterThan(
            eTrain.distance.maximum === 'unlimited' ? 0 : eTrain.distance.maximum
        )
        expect(stretchWeight(eTrain.distance, 'either')).toBe(1)
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
