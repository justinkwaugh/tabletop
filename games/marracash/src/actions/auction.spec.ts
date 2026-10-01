import { describe, expect, it } from 'vitest'
import { MarketColor } from '../definition/marketColor.js'
import { MachineState } from '../definition/states.js'
import { StartingMoney } from '../model/playerState.js'
import { Shops, type ShopId } from '../components/board.js'
import { startTestGame, type TestSession } from '../util/testHelper.js'
import { isResolveAuction } from './resolveAuction.js'

function seats(session: TestSession): string[] {
    return session.state.turnManager.turnOrder
}

function money(session: TestSession, playerId: string): number {
    return session.hydrated().getPlayerState(playerId).getMoney()
}

function owner(session: TestSession, shopId: ShopId): string | undefined {
    return session.state.shops.find((shop) => shop.shopId === shopId)?.ownerId
}

function runAuction(session: TestSession, shopId: ShopId, bids: number[]) {
    const order = seats(session)
    const auctioneer = session.currentPlayerId()
    session.startAuction(auctioneer, shopId)
    const start = order.indexOf(auctioneer)
    const clockwise = [...order.slice(start), ...order.slice(0, start)]
    let processed: ReturnType<TestSession['bid']> = []
    clockwise.forEach((playerId, index) => {
        processed = session.bid(playerId, bids[index])
    })
    return { auctioneer, clockwise, resolution: processed.find(isResolveAuction) }
}

function giveShops(session: TestSession, playerId: string, count: number) {
    const state = structuredClone(session.state)
    for (const shop of state.shops.slice(-count)) {
        shop.ownerId = playerId
    }
    session.state = state
}

describe('MarraCash auctions', () => {
    it('collects a sealed bid from every player at once', () => {
        const session = startTestGame(4)
        const auctioneer = session.currentPlayerId()
        session.startAuction(auctioneer, 'Y1')
        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(session.state.activePlayerIds.toSorted()).toEqual(seats(session).toSorted())
    })

    it('makes the winner pay the bank and gives the auctioneer a 100 cut up to 500', () => {
        const session = startTestGame(4)
        const { clockwise, resolution } = runAuction(session, 'Y1', [100, 500, 0, 0])
        const [auctioneer, winner] = clockwise
        expect(owner(session, 'Y1')).toBe(winner)
        expect(money(session, winner)).toBe(StartingMoney - 500)
        expect(money(session, auctioneer)).toBe(StartingMoney + 100)
        expect(resolution?.revealsInfo).toBe(true)
        expect(resolution?.metadata).toMatchObject({ price: 500, auctioneerCut: 100 })
    })

    it('gives the auctioneer a 200 cut above 500', () => {
        const session = startTestGame(3)
        const { clockwise } = runAuction(session, 'Y1', [100, 0, 525])
        expect(money(session, clockwise[0])).toBe(StartingMoney + 200)
        expect(money(session, clockwise[2])).toBe(StartingMoney - 525)
    })

    it('gives no cut when the auctioneer wins', () => {
        const session = startTestGame(3)
        const { auctioneer } = runAuction(session, 'Y1', [300, 0, 0])
        expect(owner(session, 'Y1')).toBe(auctioneer)
        expect(money(session, auctioneer)).toBe(StartingMoney - 300)
    })

    it('breaks ties for the auctioneer, then clockwise', () => {
        const auctioneerTie = startTestGame(4)
        const first = runAuction(auctioneerTie, 'Y1', [200, 200, 0, 0])
        expect(owner(auctioneerTie, 'Y1')).toBe(first.auctioneer)

        const clockwiseTie = startTestGame(4)
        const second = runAuction(clockwiseTie, 'Y1', [100, 0, 300, 300])
        expect(owner(clockwiseTie, 'Y1')).toBe(second.clockwise[2])
    })

    it('rejects bids that break the money rules', () => {
        const session = startTestGame(3)
        const auctioneer = session.currentPlayerId()
        session.startAuction(auctioneer, 'Y1')
        const other = seats(session).find((playerId) => playerId !== auctioneer) ?? ''
        expect(() => session.bid(auctioneer, 75)).toThrow()
        expect(() => session.bid(other, 110)).toThrow()
        expect(() => session.bid(other, StartingMoney + 25)).toThrow()
    })

    it('pulls matching visitors next to the auctioned shop in as customers', () => {
        const session = startTestGame(3)
        const state = structuredClone(session.state)
        const fountain = state.fountains.find((candidate) => candidate.fountainId === 3)
        if (fountain) fountain.visitors = [MarketColor.Blue, MarketColor.Red, MarketColor.Blue]
        session.state = state

        const { clockwise, resolution } = runAuction(session, 'B1', [100, 0, 400])
        const winner = clockwise[2]
        const shop = session.state.shops.find((candidate) => candidate.shopId === 'B1')
        expect(shop?.customers).toBe(2)
        expect(session.state.fountains.find((f) => f.fountainId === 3)?.visitors).toEqual([
            MarketColor.Red
        ])
        expect(money(session, winner)).toBe(StartingMoney - 400 + 100 + 200)
        expect(money(session, clockwise[0])).toBe(StartingMoney + 100)
        expect(resolution?.metadata?.pullIns).toEqual([
            { fountainId: 3, customers: 2, income: 300 }
        ])
    })

    it('enters 0 for a player with 6 shops without asking them', () => {
        const session = startTestGame(3)
        const auctioneer = session.currentPlayerId()
        const full = seats(session).find((playerId) => playerId !== auctioneer) ?? ''
        giveShops(session, full, 6)
        session.startAuction(auctioneer, 'Y1')
        expect(session.hydrated().getPlayerState(full).money).toBe(StartingMoney)
        const participant = session.state.auction?.participants.find(
            (candidate) => candidate.playerId === full
        )
        expect(participant?.submitted).toBe(true)
        expect(session.state.activePlayerIds).not.toContain(full)
        expect(() => session.bid(full, 0)).toThrow()
    })

    it('stops a player with 6 shops or under 100 Dirham from starting an auction', () => {
        const fullSession = startTestGame(3)
        giveShops(fullSession, fullSession.currentPlayerId(), 6)
        expect(fullSession.hydrated().canStartAuction(fullSession.currentPlayerId())).toBe(false)

        const poorSession = startTestGame(3)
        const state = structuredClone(poorSession.state)
        const poor = state.players.find((player) => player.playerId === state.activePlayerIds[0])
        if (poor) poor.money = 75
        poorSession.state = state
        expect(poorSession.hydrated().canStartAuction(poorSession.currentPlayerId())).toBe(false)
    })

    it('rejects an auction for a shop that is already owned', () => {
        const session = startTestGame(3)
        runAuction(session, 'Y1', [100, 0, 0])
        expect(() => session.startAuction(session.currentPlayerId(), 'Y1')).toThrow()
    })

    it('gives each player one auction in round 1, then two actions from round 2', () => {
        const session = startTestGame(3)
        const order = seats(session)
        const shopIds = Shops.map((shop) => shop.id)

        order.forEach((playerId, index) => {
            expect(session.currentPlayerId()).toBe(playerId)
            runAuction(session, shopIds[index], [100, 0, 0])
        })
        expect(session.state.round).toBe(2)
        expect(session.currentPlayerId()).toBe(order[0])

        runAuction(session, shopIds[3], [100, 0, 0])
        expect(session.currentPlayerId()).toBe(order[0])
        expect(session.state.machineState).toBe(MachineState.ChoosingAction)
        runAuction(session, shopIds[4], [100, 0, 0])
        expect(session.currentPlayerId()).toBe(order[1])
    })
})
