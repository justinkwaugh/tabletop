import { Color } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Shops } from '../components/board.js'
import { MaxShopsPerPlayer } from '../components/payments.js'
import { MachineState } from '../definition/states.js'
import { startTestGame } from '../util/testHelper.js'
import { HydratedMarracashPlayerState } from './playerState.js'

describe('MarraCash game state', () => {
    it('puts a player at the shop limit once they own six shops', () => {
        const session = startTestGame(3)
        const [playerId] = session.state.turnManager.turnOrder
        session.edit((state) => {
            for (const shop of state.shops.slice(0, MaxShopsPerPlayer - 1)) {
                shop.ownerId = playerId
            }
        })
        expect(session.hydrated().isAtShopLimit(playerId)).toBe(false)
        session.edit((state) => {
            state.shops[MaxShopsPerPlayer - 1].ownerId = playerId
        })
        expect(session.hydrated().isAtShopLimit(playerId)).toBe(true)
    })

    it('names the last seat for the final turn once the queue runs out, until the game ends', () => {
        const session = startTestGame(3)
        const lastSeat = session.state.turnManager.turnOrder.at(-1)
        expect(session.hydrated().finalTurnPlayerId()).toBeUndefined()
        session.edit((state) => {
            state.finalRound = true
        })
        expect(session.hydrated().finalTurnPlayerId()).toBe(lastSeat)
        session.edit((state) => {
            state.machineState = MachineState.EndOfGame
        })
        expect(session.hydrated().finalTurnPlayerId()).toBeUndefined()
    })

    it('waits only on bidders who have not submitted a bid', () => {
        const session = startTestGame(3)
        const [auctioneer, second, third] = session.state.turnManager.turnOrder
        session.startAuction(auctioneer, Shops[0].id)
        expect(session.hydrated().auction?.awaitingBidderIds()).toEqual([auctioneer, second, third])
        session.bid(auctioneer, 100)
        expect(session.hydrated().auction?.awaitingBidderIds()).toEqual([second, third])
    })
})

describe('MarraCash player state', () => {
    it('adds and removes money', () => {
        const player = new HydratedMarracashPlayerState({
            playerId: 'p1',
            color: Color.Orange,
            money: 500,
            antiques: [],
            revealedAntiques: []
        })
        player.adjustMoney(-200)
        player.adjustMoney(50)
        expect(player.money).toBe(350)
    })

    it('leaves hidden money unread for a zero change', () => {
        const player = new HydratedMarracashPlayerState({
            playerId: 'p1',
            color: Color.Orange,
            antiques: [],
            revealedAntiques: []
        })
        expect(() => player.adjustMoney(0)).not.toThrow()
        expect(() => player.adjustMoney(100)).toThrow()
    })
})
