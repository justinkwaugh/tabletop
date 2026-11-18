import { describe, expect, it } from 'vitest'
import {
    auctionAtFaceValue,
    cashOf,
    chooseInvestors,
    holderOf,
    kit,
    opened,
    type Table
} from '../test/kit.js'
import { ForeignInvestors1880 } from './companies.js'
import { investorsInGame, unchosenInvestors } from './investors.js'
import { isInvestor } from './stock.js'
import { seatsByCash } from './opening.js'

/** The investors with a home held for them on the map, in number order. */
function reservedInvestors(game: Table): string[] {
    return game.state.stationReservations
        .map((reservation) => reservation.companyId)
        .filter(isInvestor)
        .toSorted()
}

/** The current chooser takes the lowest-numbered investor left. */
function chooseOne(game: Table): void {
    game.act('ChooseInvestor', { investorId: unchosenInvestors(game.hydrated)[0] })
}

describe('the private auction (§V)', () => {
    it('auctions P0 first, its starter passing and the next player bidding', () => {
        const game = kit.table(4, 3)
        const [first, second] = game.state.turnManager.turnOrder
        expect(game.state.selectionAuction?.remainingLotIds[0]).toBe('P0')
        game.act('PassSelectionAuction', {}, first)
        game.act('NominateLot', { lotId: 'P0', amount: 5 }, second)
        // The starter passed and is out of P0's auction.
        expect(game.valid(first)).not.toContain('BidForLot')
    })

    it('lowers P0 by ¥5 when everyone passes, then gives it away free', () => {
        const game = kit.table(3, 3)
        const starter = game.player
        for (let round = 0; round < 2; round++)
            for (let pass = 0; pass < 3; pass++) game.act('PassSelectionAuction')
        expect(holderOf(game, 'P0:charter')).toBe(starter)
        expect(cashOf(game, starter)).toBe(600)
    })

    it('starts each lot with the player after the one who started the last', () => {
        const game = kit.table(4, 3)
        const order = game.state.turnManager.turnOrder
        game.act('PassSelectionAuction', {}, order[0])
        game.act('NominateLot', { lotId: 'P0', amount: 5 }, order[1])
        for (const playerId of [order[2], order[3]]) game.act('PassSelectionAuction', {}, playerId)
        expect(holderOf(game, 'P0:charter')).toBe(order[1])
        expect(game.player).toBe(order[1])
    })

    it('pays the privates’ income when everyone passes on a later private', () => {
        const game = kit.table(3, 3)
        const order = game.state.turnManager.turnOrder
        game.act('NominateLot', { lotId: 'P0', amount: 5 }, order[0])
        for (const playerId of [order[1], order[2]]) game.act('PassSelectionAuction', {}, playerId)
        game.act('NominateLot', { lotId: 'P1', amount: 10 }, order[1])
        for (const playerId of [order[2], order[0]]) game.act('PassSelectionAuction', {}, playerId)
        const before = cashOf(game, order[1])
        for (const playerId of [order[2], order[0], order[1]])
            game.act('PassSelectionAuction', {}, playerId)
        expect(cashOf(game, order[1])).toBe(before + 5)
        expect(game.state.selectionAuction?.remainingLotIds[0]).toBe('P2')
        expect(game.player).toBe(order[2])
    })

    it('gives P6’s buyer the BCR at ¥100, in a slot of their choosing', () => {
        const game = kit.table(4, 3)
        auctionAtFaceValue(game)
        const bcr = game.state.companies.find((company) => company.id === 'BCR')
        expect(bcr?.started).toBe(true)
        expect(bcr?.parPrice).toBe(100)
        expect(game.state.permits.BCR).toBe('ABC')
        expect(game.state.parSlots.BCR).toBe(0)
        expect(game.state.companies.find((company) => company.id === 'P6')?.closed).toBe(true)
    })

    it('reseats the players by cash, least first, then has them choose investors', () => {
        const game = kit.table(4, 3)
        auctionAtFaceValue(game)
        expect(game.state.machineState).toBe('ChoosingInvestors')
        const order = game.state.turnManager.turnOrder
        const cash = order.map((playerId) => cashOf(game, playerId))
        expect(cash).toEqual([...cash].sort((a, b) => a - b))
        expect(seatsByCash(game.hydrated)).toEqual(order)
        expect(game.player).toBe(order[0])
    })

    it('gives each player a turn of their own to choose, then opens the share round', () => {
        const game = kit.table(4, 3)
        auctionAtFaceValue(game)
        const order = [...game.state.turnManager.turnOrder]
        const choosers: string[] = []
        while (game.state.machineState === 'ChoosingInvestors') {
            const turn = game.hydrated.turnManager.currentTurn()
            expect(turn?.playerId).toBe(game.player)
            choosers.push(game.player ?? '')
            const before = game.hydrated.turnManager.turnCount(game.player ?? '')
            const playerId = game.player ?? ''
            chooseOne(game)
            expect(game.hydrated.turnManager.turnCount(playerId)).toBe(before + 1)
        }
        expect(choosers).toEqual(order)
        expect(game.hydrated.turnManager.currentTurn()?.playerId).toBe(order[0])
        expect(game.player).toBe(order[0])
    })

    it('holds every investor’s home from the start of the game', () => {
        const game = kit.table(4, 3)
        expect(
            game.state.stationReservations.filter((reservation) =>
                isInvestor(reservation.companyId)
            )
        ).toEqual(
            expect.arrayContaining(
                ForeignInvestors1880.map((investor) => ({
                    companyId: investor.id,
                    locationId: investor.home,
                    nodeId: 'city'
                }))
            )
        )
        expect(reservedInvestors(game)).toEqual(ForeignInvestors1880.map(({ id }) => id))
    })

    it('keeps the homes of investors still to be chosen until every player has one', () => {
        const game = kit.table(4, 3)
        auctionAtFaceValue(game)
        chooseOne(game)
        expect(reservedInvestors(game)).toEqual(['A2', 'A3', 'A4', 'A5', 'A6', 'A7'])
        chooseInvestors(game)
        expect(reservedInvestors(game)).toEqual([])
    })

    it('places each chosen investor in its home and removes the rest', () => {
        const game = kit.table(4, 3)
        auctionAtFaceValue(game)
        const bcrDirector = holderOf(game, 'BCR:president')
        chooseInvestors(game)
        expect(game.state.machineState).toBe('StockRound')
        const placed = game.state.stations.filter(
            (station) => station.companyId.startsWith('A') && station.status === 'placed'
        )
        expect(placed.map((station) => station.companyId)).toEqual(['A1', 'A2', 'A3', 'A4'])
        expect(game.state.companies.filter((company) => company.closed).map((c) => c.id)).toEqual(
            expect.arrayContaining(['A5', 'A6', 'A7'])
        )
        // The BCR's director placed a BCR share on their investor (§VII).
        const investor = ['A1', 'A2', 'A3', 'A4'].find(
            (id) => holderOf(game, `${id}:president`) === bcrDirector
        )
        expect(
            game.state.certificates.some(
                (certificate) =>
                    certificate.companyId === 'BCR' &&
                    certificate.owner.kind === 'company' &&
                    certificate.owner.companyId === investor
            )
        ).toBe(true)
    })

    it('opens the first share round with the least-moneyed player', () => {
        const game = opened(4, 3)
        expect(game.player).toBe(game.state.turnManager.turnOrder[0])
        expect(game.valid()).toContain('StartCompany')
        expect(game.valid()).not.toContain('SellShares')
    })
})

describe('the random investors variant', () => {
    const investorIds = ForeignInvestors1880.map((investor) => investor.id)
    const closedInvestors = (game: Table) =>
        game.state.companies
            .filter((company) => isInvestor(company.id) && company.closed)
            .map((company) => company.id)

    it('plays with every investor without the variant', () => {
        const game = kit.table(4, 3)
        expect(game.state.removedInvestorIds).toBeUndefined()
        expect(investorsInGame(game.state)).toEqual(investorIds)
        expect(closedInvestors(game)).toEqual([])
    })

    it('draws one investor per player and leaves the rest out of the game', () => {
        const game = kit.table(4, 3, { randomInvestors: true })
        const removed = game.state.removedInvestorIds ?? []
        expect(removed).toHaveLength(3)
        expect(closedInvestors(game).toSorted()).toEqual(removed.toSorted())
        const inGame = investorIds.filter((id) => !removed.includes(id))
        expect(investorsInGame(game.state)).toEqual(inGame)
        expect(reservedInvestors(game)).toEqual(inGame)
        auctionAtFaceValue(game)
        expect(game.state.machineState).toBe('ChoosingInvestors')
        expect(unchosenInvestors(game.hydrated)).toEqual(inGame)
        expect(() => game.act('ChooseInvestor', { investorId: removed[0] })).toThrow()
        chooseInvestors(game)
        expect(game.state.machineState).toBe('StockRound')
        const placed = game.state.stations
            .filter((station) => isInvestor(station.companyId) && station.status === 'placed')
            .map((station) => station.companyId)
        expect(placed).toEqual(inGame)
        expect(closedInvestors(game).toSorted()).toEqual(removed.toSorted())
    })

    it('leaves no investor out with seven players', () => {
        const game = kit.table(7, 3, { randomInvestors: true })
        expect(game.state.removedInvestorIds).toBeUndefined()
        expect(closedInvestors(game)).toEqual([])
    })

    it('draws different investors with different seeds', () => {
        const draws = new Set(
            [1, 2, 3, 4, 5, 6].map((seed) =>
                kit.table(3, seed, { randomInvestors: true }).state.removedInvestorIds?.join()
            )
        )
        expect(draws.size).toBeGreaterThan(1)
    })
})
