import { CardinalDirection } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { paidAntiques, type Antique } from '../components/antiques.js'
import { EntranceFountainIds, type FountainId, type ShopId } from '../components/board.js'
import { ActionType } from '../definition/actions.js'
import { MarketColor } from '../definition/marketColor.js'
import { MachineState } from '../definition/states.js'
import { startTestGame, type TestSession } from '../util/testHelper.js'
import { QueueEnd } from '../components/visitors.js'
import { isCompleteAntiqueSet } from './completeAntiqueSet.js'
import { isMoveVisitors } from './moveVisitors.js'

const { Red, Blue, Green, Purple, Yellow } = MarketColor

type Setup = {
    round?: number
    fountains?: Partial<Record<FountainId, MarketColor[]>>
    shops?: Partial<Record<ShopId, { ownerId: string; customers?: number }>>
    money?: Record<string, number>
    antiques?: Record<string, Antique[]>
}

function arrange(session: TestSession, setup: Setup) {
    session.edit((state) => {
        state.round = setup.round ?? 2
        for (const fountain of state.fountains) {
            const entranceDefault = EntranceFountainIds.includes(fountain.fountainId)
                ? [Yellow]
                : []
            fountain.visitors = setup.fountains?.[fountain.fountainId] ?? entranceDefault
        }
        for (const shop of state.shops) {
            const arranged = setup.shops?.[shop.shopId]
            shop.ownerId = arranged?.ownerId
            shop.customers = arranged?.customers ?? 0
        }
        for (const player of state.players) {
            player.money = setup.money?.[player.playerId] ?? player.money
            player.antiques = setup.antiques?.[player.playerId] ?? player.antiques
        }
    })
}

function move(session: TestSession, fountainId: FountainId, direction: CardinalDirection) {
    return session.act(session.currentPlayerId(), ActionType.MoveVisitors, {
        fountainId,
        direction
    })
}

function visitorsAt(session: TestSession, fountainId: FountainId): MarketColor[] {
    return (
        session.state.fountains.find((fountain) => fountain.fountainId === fountainId)?.visitors ??
        []
    )
}

function customersIn(session: TestSession, shopId: ShopId): number {
    return session.state.shops.find((shop) => shop.shopId === shopId)?.customers ?? 0
}

function money(session: TestSession, playerId: string): number {
    return session.hydrated().getPlayerState(playerId).getMoney()
}

function players(session: TestSession) {
    const [mover, other, third] = session.state.turnManager.turnOrder
    return { mover, other, third }
}

describe('MarraCash movement', () => {
    it('does not allow moves in round 1', () => {
        const session = startTestGame(3)
        arrange(session, { round: 1, fountains: { 9: [Red] } })
        expect(() => move(session, 9, CardinalDirection.East)).toThrow()
    })

    it('moves the whole group to the next fountain along the route', () => {
        const session = startTestGame(3)
        arrange(session, { fountains: { 9: [Red, Blue], 10: [Green] } })
        move(session, 9, CardinalDirection.East)
        expect(visitorsAt(session, 9)).toEqual([])
        expect(visitorsAt(session, 10)).toEqual([Green, Red, Blue])
    })

    it('sends matching visitors into the first owned shop of their colour', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, {
            fountains: { 4: [Purple, Purple, Yellow] },
            shops: { P1: { ownerId: other }, P3: { ownerId: mover } }
        })
        const processed = move(session, 4, CardinalDirection.North)
        expect(customersIn(session, 'P1')).toBe(2)
        expect(customersIn(session, 'P3')).toBe(0)
        expect(visitorsAt(session, 3)).toEqual([Yellow])
        const result = processed.find(isMoveVisitors)?.metadata
        expect(result?.entries).toEqual([
            { shopId: 'P1', ownerId: other, customers: 2, income: 300, moverCut: 100 }
        ])
    })

    it('counts stopping next to a door as passing it', () => {
        const session = startTestGame(3)
        const { other } = players(session)
        arrange(session, { fountains: { 9: [Yellow] }, shops: { Y3: { ownerId: other } } })
        move(session, 9, CardinalDirection.East)
        expect(customersIn(session, 'Y3')).toBe(1)
        expect(visitorsAt(session, 10)).toEqual([])
    })

    it('pays customers one after another, up to 500 each', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, {
            fountains: { 9: [Blue, Blue, Blue] },
            shops: { B4: { ownerId: other, customers: 3 } },
            money: { [mover]: 1000, [other]: 1000 }
        })
        move(session, 9, CardinalDirection.East)
        expect(customersIn(session, 'B4')).toBe(6)
        const income = 400 + 500 + 500
        expect(money(session, other)).toBe(1000 + income - 300)
        expect(money(session, mover)).toBe(1000 + 300)
    })

    it('pays the mover 50 per customer up to 300 profit and 100 above', () => {
        const low = startTestGame(3)
        const lowPlayers = players(low)
        arrange(low, {
            fountains: { 9: [Blue, Blue] },
            shops: { B4: { ownerId: lowPlayers.other } },
            money: { [lowPlayers.mover]: 1000 }
        })
        move(low, 9, CardinalDirection.East)
        expect(money(low, lowPlayers.mover)).toBe(1000 + 100)

        const high = startTestGame(3)
        const highPlayers = players(high)
        arrange(high, {
            fountains: { 9: [Blue, Blue] },
            shops: { B4: { ownerId: highPlayers.other, customers: 1 } },
            money: { [highPlayers.mover]: 1000 }
        })
        move(high, 9, CardinalDirection.East)
        expect(money(high, highPlayers.mover)).toBe(1000 + 200)
    })

    it('pays no cut for visitors moved into the mover’s own shop', () => {
        const session = startTestGame(3)
        const { mover } = players(session)
        arrange(session, {
            fountains: { 9: [Blue] },
            shops: { B4: { ownerId: mover } },
            money: { [mover]: 1000 }
        })
        move(session, 9, CardinalDirection.East)
        expect(money(session, mover)).toBe(1100)
    })

    it('rejects a move from an empty fountain or in a blocked direction', () => {
        const session = startTestGame(3)
        arrange(session, { fountains: { 9: [Red] } })
        expect(() => move(session, 10, CardinalDirection.East)).toThrow()
        expect(() => move(session, 2, CardinalDirection.North)).toThrow()
        expect(visitorsAt(session, 9)).toEqual([Red])
    })

    it('allows move then auction, but not auction then move', () => {
        const session = startTestGame(3)
        const { mover } = players(session)
        arrange(session, { fountains: { 9: [Red], 14: [Green] } })
        move(session, 9, CardinalDirection.East)
        expect(session.currentPlayerId()).toBe(mover)

        const auctionFirst = startTestGame(3)
        arrange(auctionFirst, { fountains: { 9: [Red] } })
        const auctioneer = auctionFirst.currentPlayerId()
        auctionFirst.startAuction(auctioneer, 'Y1')
        for (const playerId of auctionFirst.state.turnManager.turnOrder) {
            auctionFirst.bid(playerId, playerId === auctioneer ? 100 : 0)
        }
        expect(auctionFirst.currentPlayerId()).toBe(auctioneer)
        expect(() => move(auctionFirst, 9, CardinalDirection.East)).toThrow()
    })

    it('ends the turn after two moves without asking for a confirmation, leaving it undoable', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, { fountains: { 9: [Red], 14: [Green] } })
        move(session, 9, CardinalDirection.East)
        const processed = move(session, 14, CardinalDirection.East)
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.MoveVisitors,
            ActionType.EndTurn
        ])
        expect(processed.some((action) => action.revealsInfo)).toBe(false)
        expect(session.currentPlayerId()).toBe(other)
        expect(session.state.machineState).toBe(MachineState.ChoosingAction)
        expect(session.state.activePlayerIds).not.toContain(mover)
    })

    it('keeps the confirmation step and Undo barriers for a game started under 0.1.0', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        session.edit((state) => {
            delete state.undoStopsOnlyAtReveals
        })
        arrange(session, { fountains: { 9: [Red], 14: [Green] } })
        move(session, 9, CardinalDirection.East)
        move(session, 14, CardinalDirection.East)
        expect(session.state.machineState).toBe(MachineState.ConfirmingTurn)
        expect(session.currentPlayerId()).toBe(mover)

        const processed = session.confirmTurn(mover)
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.ConfirmTurn,
            ActionType.EndTurn
        ])
        expect(processed.at(-1)?.revealsInfo).toBe(true)
        expect(session.currentPlayerId()).toBe(other)
        expect(session.startAuction(other, 'Y1')[0].revealsInfo).toBe(true)
    })

    it('asks the turn player to refill an entrance emptied before an auction', () => {
        const session = startTestGame(3)
        const { mover } = players(session)
        arrange(session, { fountains: { 16: [Blue] } })
        move(session, 16, CardinalDirection.West)
        session.startAuction(mover, 'Y1')
        for (const playerId of session.state.turnManager.turnOrder) {
            session.bid(playerId, playerId === mover ? 100 : 0)
        }

        expect(session.state.machineState).toBe(MachineState.RefillingEntrances)
        expect(session.state.activePlayerIds).toEqual([mover])
        session.bringVisitors(mover, QueueEnd.Front, 3, 16)
        expect(session.state.fountains.find((f) => f.fountainId === 16)?.visitors).toHaveLength(3)
    })
})

describe('MarraCash antique sets', () => {
    const hand: Antique[] = [
        { color: Blue, value: 225 },
        { color: Blue, value: 200 },
        { color: Red, value: 150 },
        { color: Red, value: 50 },
        { color: Green, value: 100 }
    ]

    it('keeps a completed set secret until the turn’s last action, then reveals and pays it', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, {
            fountains: { 9: [Blue], 14: [Purple] },
            shops: {
                B4: { ownerId: other, customers: 1 },
                R1: { ownerId: other, customers: 2 },
                G1: { ownerId: other, customers: 1 }
            },
            money: { [mover]: 1000, [other]: 1000 },
            antiques: { [other]: hand }
        })
        const firstMove = move(session, 9, CardinalDirection.East)
        expect(firstMove.find(isCompleteAntiqueSet)).toBeUndefined()
        expect(session.state.pendingAntiqueSets).toEqual([other])
        expect(money(session, other)).toBe(1000 + 200 - 50)
        expect(money(session, mover)).toBe(1000 + 50)

        const processed = move(session, 14, CardinalDirection.East)
        const completion = processed.find(isCompleteAntiqueSet)
        expect(completion?.collectorId).toBe(other)
        expect(completion?.revealsInfo).toBe(true)
        expect(completion?.metadata).toEqual({ cards: hand, rank: 0, payout: 725 })

        const collector = session.state.players.find((player) => player.playerId === other)
        expect(collector?.revealedAntiques).toEqual(hand)
        expect(collector?.antiques).toEqual([])
        expect(session.state.antiqueRevealOrder).toEqual([other])
        expect(money(session, other)).toBe(1000 + 200 - 50 + 725)
    })

    it('completes a pending set before anyone bids when the mover then starts an auction', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, {
            fountains: { 9: [Blue] },
            shops: {
                B4: { ownerId: other, customers: 1 },
                R1: { ownerId: other, customers: 2 },
                G1: { ownerId: other, customers: 1 }
            },
            money: { [mover]: 1000, [other]: 1000 },
            antiques: { [other]: hand }
        })
        move(session, 9, CardinalDirection.East)
        const processed = session.startAuction(mover, 'Y1')
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.StartAuction,
            ActionType.CompleteAntiqueSet
        ])
        expect(processed[0].revealsInfo).toBeFalsy()
        expect(processed[1].revealsInfo).toBe(true)
        expect(money(session, other)).toBe(1000 + 200 - 50 + 725)
        expect(session.state.machineState).toBe(MachineState.Bidding)
    })

    it('commits the turn, set included, when the last emptied entrance is refilled', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, {
            fountains: { 9: [Blue] },
            shops: {
                B4: { ownerId: other, customers: 1 },
                R1: { ownerId: other, customers: 2 },
                G1: { ownerId: other, customers: 1 }
            },
            antiques: { [other]: hand }
        })
        move(session, 9, CardinalDirection.East)
        move(session, 16, CardinalDirection.West)
        expect(session.state.machineState).toBe(MachineState.RefillingEntrances)
        expect(session.state.antiqueRevealOrder).toEqual([])

        const processed = session.bringVisitors(mover, QueueEnd.Front, 3, 16)
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.BringVisitors,
            ActionType.CompleteAntiqueSet,
            ActionType.EndTurn
        ])
        expect(processed.at(-1)?.revealsInfo).toBe(false)
        expect(processed.find(isCompleteAntiqueSet)?.revealsInfo).toBe(true)
        expect(session.state.antiqueRevealOrder).toEqual([other])
        expect(session.currentPlayerId()).toBe(other)
    })

    it('leaves the last refill of a turn undoable when it reveals nothing', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, { fountains: { 9: [Blue] } })
        move(session, 9, CardinalDirection.East)
        move(session, 16, CardinalDirection.West)

        const processed = session.bringVisitors(mover, QueueEnd.Front, 3, 16)
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.BringVisitors,
            ActionType.EndTurn
        ])
        expect(processed.some((action) => action.revealsInfo)).toBe(false)
        expect(session.currentPlayerId()).toBe(other)
    })

    function oneColorHand(color: MarketColor): Antique[] {
        return [225, 200, 150, 100, 50].map((value) => ({ color, value }))
    }

    function completionOrder(processed: ReturnType<TestSession['act']>) {
        return processed
            .filter(isCompleteAntiqueSet)
            .map((action) => [action.collectorId, action.metadata?.rank])
    }

    it('ranks sets one move completes by the order its path enters their shops', () => {
        const session = startTestGame(3)
        const { mover, other, third } = players(session)
        arrange(session, {
            fountains: { 1: [Purple, Green], 14: [Red] },
            shops: {
                G2: { ownerId: third, customers: 4 },
                P2: { ownerId: other, customers: 4 }
            },
            antiques: { [other]: oneColorHand(Purple), [third]: oneColorHand(Green) }
        })
        move(session, 1, CardinalDirection.South)
        move(session, 14, CardinalDirection.East)
        const processed = session.bringVisitors(mover, QueueEnd.Front, 3, 1)
        expect(completionOrder(processed)).toEqual([
            [third, 0],
            [other, 1]
        ])
    })

    it('ranks sets completed by a turn’s two moves in the order they were completed', () => {
        const session = startTestGame(3)
        const { mover, other, third } = players(session)
        arrange(session, {
            fountains: { 1: [Green], 3: [Blue] },
            shops: {
                G2: { ownerId: third, customers: 4 },
                B1: { ownerId: other, customers: 4 }
            },
            antiques: { [other]: oneColorHand(Blue), [third]: oneColorHand(Green) }
        })
        move(session, 1, CardinalDirection.South)
        move(session, 3, CardinalDirection.South)
        const processed = session.bringVisitors(mover, QueueEnd.Front, 3, 1)
        expect(completionOrder(processed)).toEqual([
            [third, 0],
            [other, 1]
        ])
    })

    it('never completes a set when antique cards are turned off', () => {
        const session = startTestGame(3, { antiqueCards: false })
        const { other } = players(session)
        arrange(session, {
            fountains: { 9: [Blue] },
            shops: {
                B4: { ownerId: other, customers: 1 },
                R1: { ownerId: other, customers: 2 },
                G1: { ownerId: other, customers: 1 }
            }
        })
        const processed = move(session, 9, CardinalDirection.East)
        expect(processed.find(isCompleteAntiqueSet)).toBeUndefined()
        expect(session.state.antiqueRevealOrder).toEqual([])
    })

    it('refuses to judge a set from a hand it cannot see', () => {
        const session = startTestGame(3)
        const { other } = players(session)
        arrange(session, {
            fountains: { 9: [Blue] },
            shops: { B4: { ownerId: other } },
            antiques: { [other]: [] }
        })
        expect(() => move(session, 9, CardinalDirection.East)).toThrow(/not known/)
    })

    it('pays later collectors for fewer of their best cards', () => {
        const session = startTestGame(3)
        const { mover, other, third } = players(session)
        arrange(session, {
            fountains: { 9: [Blue], 14: [Purple] },
            shops: {
                B4: { ownerId: other, customers: 1 },
                R1: { ownerId: other, customers: 2 },
                G1: { ownerId: other, customers: 1 }
            },
            money: { [other]: 1000 },
            antiques: { [other]: hand }
        })
        session.edit((state) => {
            state.antiqueRevealOrder = [mover, third]
        })
        move(session, 9, CardinalDirection.East)
        const processed = move(session, 14, CardinalDirection.East)
        expect(processed.find(isCompleteAntiqueSet)?.metadata?.payout).toBe(225 + 200 + 150)
        expect(paidAntiques(hand, 2)).toEqual([hand[0], hand[1], hand[2]])
    })

    it('records a set completed by an auction before the turn passes on', () => {
        const session = startTestGame(3)
        const { mover, other } = players(session)
        arrange(session, {
            round: 1,
            fountains: { 3: [Blue] },
            shops: {
                B4: { ownerId: mover, customers: 1 },
                R1: { ownerId: mover, customers: 2 },
                G1: { ownerId: mover, customers: 1 }
            },
            antiques: { [mover]: hand }
        })
        session.startAuction(mover, 'B1')
        let processed: ReturnType<TestSession['bid']> = []
        for (const playerId of session.state.turnManager.turnOrder) {
            processed = session.bid(playerId, playerId === mover ? 100 : 0)
        }
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlaceBid,
            ActionType.ResolveAuction,
            ActionType.CompleteAntiqueSet,
            ActionType.EndTurn
        ])
        expect(session.state.antiqueRevealOrder).toEqual([mover])
        expect(session.currentPlayerId()).toBe(other)
    })
})
