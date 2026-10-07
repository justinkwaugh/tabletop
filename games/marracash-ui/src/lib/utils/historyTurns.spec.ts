import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    MarketColor,
    QueueEnd,
    type AuctionResult,
    type MoveResult
} from '@tabletop/marracash'
import { historyEntries, type HistoryTurn, type OpenAuction } from './historyTurns.js'

const TurnOrder = ['amira', 'bashir', 'chadia']

let nextId = 0

function action(type: ActionType, extra: object = {}): GameAction {
    return {
        id: `action-${nextId++}`,
        gameId: 'game',
        type,
        source: ActionSource.User,
        ...extra
    }
}

const endTurn = () => action(ActionType.EndTurn, { source: ActionSource.System })

function move(playerId: string, metadata: MoveResult): GameAction {
    return action(ActionType.MoveVisitors, {
        playerId,
        fountainId: 8,
        direction: 'north',
        metadata
    })
}

function bring(playerId: string, end: QueueEnd, entranceId: number, visitors: MarketColor[]) {
    return action(ActionType.BringVisitors, {
        playerId,
        end,
        count: visitors.length,
        entranceId,
        metadata: { visitors }
    })
}

const startAuction = (playerId: string, shopId: string) =>
    action(ActionType.StartAuction, { playerId, shopId })

const resolveAuction = (metadata: AuctionResult) =>
    action(ActionType.ResolveAuction, { source: ActionSource.System, revealsInfo: true, metadata })

function turns(entries: ReturnType<typeof historyEntries>): HistoryTurn[] {
    return entries.filter((entry): entry is HistoryTurn => entry.kind === 'turn')
}

describe('MarraCash history turns', () => {
    it('credits the mover a shop’s whole income in their own shop and only the cut elsewhere', () => {
        const actions = [
            move('amira', {
                destinationId: 4,
                arrivals: [MarketColor.Blue],
                entries: [
                    { shopId: 'Y1', ownerId: 'bashir', customers: 2, income: 500, moverCut: 200 },
                    { shopId: 'P1', ownerId: 'amira', customers: 1, income: 100, moverCut: 0 }
                ]
            }),
            endTurn()
        ]
        const [turn] = turns(historyEntries(actions, TurnOrder, false))

        expect(turn.playerId).toBe('amira')
        expect(turn.ended).toBe(true)
        expect([turn.firstIndex, turn.lastIndex]).toEqual([0, 1])
        expect(turn.lines).toHaveLength(1)
        const [line] = turn.lines
        expect(line.kind === 'move' && line.visits.map((visit) => visit.moverIncome)).toEqual([
            200, 100
        ])
        expect(turn.moverNet).toBe(300)
        expect(turn.others).toEqual([{ playerId: 'bashir', amount: 300 }])
    })

    it('charges the winner the price less any walk-ins and pays the auctioneer the cut', () => {
        const result: AuctionResult = {
            shopId: 'P1',
            bids: [
                { playerId: 'amira', amount: 100 },
                { playerId: 'bashir', amount: 300 },
                { playerId: 'chadia', amount: 0 }
            ],
            winnerId: 'bashir',
            price: 300,
            auctioneerCut: 100,
            pullIns: [{ fountainId: 5, customers: 2, income: 300 }]
        }
        const actions = [startAuction('amira', 'P1'), resolveAuction(result), endTurn()]
        const [turn] = turns(historyEntries(actions, TurnOrder, false))

        expect(turn.lines).toEqual([
            expect.objectContaining({
                kind: 'auction',
                color: MarketColor.Purple,
                result,
                walkIns: { count: 2, income: 300 },
                bidders: []
            })
        ])
        expect(turn.moverNet).toBe(100)
        expect(turn.others).toEqual([])
    })

    it('shows who has bid on the auction still open', () => {
        const openAuction: OpenAuction = {
            shopId: 'P1',
            bidding: {
                participants: [
                    { playerId: 'amira', submitted: true },
                    { playerId: 'bashir' },
                    { playerId: 'chadia', submitted: true }
                ]
            }
        }
        const [turn] = turns(
            historyEntries([startAuction('amira', 'P1')], TurnOrder, false, openAuction)
        )

        expect(turn.ended).toBe(false)
        expect(turn.lines[0]).toMatchObject({
            kind: 'auction',
            bidders: [
                { playerId: 'amira', submitted: true },
                { playerId: 'bashir', submitted: false },
                { playerId: 'chadia', submitted: true }
            ]
        })
    })

    it('names the gate a refill entered by its wall', () => {
        const actions = [
            bring('amira', QueueEnd.Front, 1, [MarketColor.Red]),
            bring('amira', QueueEnd.Back, 8, [MarketColor.Blue]),
            bring('amira', QueueEnd.Front, 16, [MarketColor.Green])
        ]
        const [turn] = turns(historyEntries(actions, TurnOrder, false))

        expect(turn.lines.map((line) => line.kind === 'bring' && [line.end, line.gate])).toEqual([
            [QueueEnd.Front, 'north'],
            [QueueEnd.Back, 'west'],
            [QueueEnd.Front, 'south']
        ])
    })

    it('counts a turn with nothing to do, so later turns keep their seats and rounds', () => {
        const actions = [
            endTurn(),
            bring('bashir', QueueEnd.Front, 1, [MarketColor.Red]),
            endTurn(),
            endTurn(),
            bring('amira', QueueEnd.Back, 8, [MarketColor.Blue])
        ]
        const entries = historyEntries(actions, TurnOrder, false)

        expect(
            entries.map((entry) =>
                entry.kind === 'round'
                    ? `round ${entry.round}`
                    : `${entry.playerId}:${entry.lines.length}`
            )
        ).toEqual(['round 2', 'amira:1', 'round 1', 'chadia:0', 'bashir:1', 'amira:0'])
        expect(
            entries.flatMap((entry) =>
                entry.kind === 'turn' ? [[entry.firstIndex, entry.lastIndex]] : []
            )
        ).toEqual([
            [4, 4],
            [3, 3],
            [1, 2],
            [0, 0]
        ])
    })

    it('marks only the latest round final once the queue has run out', () => {
        const actions = [endTurn(), endTurn(), endTurn(), endTurn()]
        const rounds = historyEntries(actions, TurnOrder, true).filter(
            (entry) => entry.kind === 'round'
        )

        expect(rounds.map((entry) => [entry.round, entry.final])).toEqual([
            [2, true],
            [1, false]
        ])
    })

    it('credits a completed antique set to its collector, who need not be the mover', () => {
        const actions = [
            action(ActionType.CompleteAntiqueSet, {
                source: ActionSource.System,
                collectorId: 'chadia',
                revealsInfo: true,
                metadata: { cards: [], rank: 0, payout: 400 }
            }),
            endTurn()
        ]
        const [turn] = turns(historyEntries(actions, TurnOrder, false))

        expect(turn.lines).toMatchObject([{ kind: 'antiqueSet', collectorId: 'chadia', rank: 0 }])
        expect(turn.moverNet).toBe(0)
        expect(turn.others).toEqual([{ playerId: 'chadia', amount: 400 }])
    })
})
