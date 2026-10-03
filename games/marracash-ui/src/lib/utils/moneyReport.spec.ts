import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, MarketColor, type AuctionResult, type MoveResult } from '@tabletop/marracash'
import {
    antiqueSetPayments,
    auctionPayments,
    latestTurnStep,
    moneyReports,
    movedVisitors,
    movePayments
} from './moneyReport.js'

function action(type: ActionType, source: ActionSource, extra: object = {}): GameAction {
    return { id: `${type}-${source}`, gameId: 'game', type, source, ...extra }
}

const auction: AuctionResult = {
    shopId: 'P1',
    bids: [
        { playerId: 'chadia', amount: 100 },
        { playerId: 'amira', amount: 300 },
        { playerId: 'bashir', amount: 0 },
        { playerId: 'dev', amount: 250 }
    ],
    winnerId: 'amira',
    price: 300,
    auctioneerCut: 100,
    pullIns: [{ fountainId: 5, customers: 2, income: 300 }]
}

describe('MarraCash money report', () => {
    it('lists the winning bid, walk-in customers and the auctioneer cut, in that order', () => {
        expect(auctionPayments(auction)).toEqual([
            { kind: 'winningBid', playerId: 'amira', amount: -300 },
            {
                kind: 'customers',
                playerId: 'amira',
                amount: 300,
                color: MarketColor.Purple,
                count: 2,
                walkedIn: true
            },
            { kind: 'auctioneerCut', playerId: 'chadia', amount: 100 }
        ])
    })

    it('combines walk-ins from several fountains into one row', () => {
        const pullIns: AuctionResult['pullIns'] = [
            { fountainId: 5, customers: 2, income: 300 },
            { fountainId: 6, customers: 1, income: 200 }
        ]
        expect(auctionPayments({ ...auction, pullIns })).toContainEqual({
            kind: 'customers',
            playerId: 'amira',
            amount: 500,
            color: MarketColor.Purple,
            count: 3,
            walkedIn: true
        })
    })

    it('gives no cut row when the auctioneer wins', () => {
        const won = { ...auction, winnerId: 'chadia', price: 100, auctioneerCut: 0, pullIns: [] }
        expect(auctionPayments(won)).toEqual([
            { kind: 'winningBid', playerId: 'chadia', amount: -100 }
        ])
    })

    it('pays each shop owner and charges a mover cut only for shops the mover does not own', () => {
        const move: MoveResult = {
            destinationId: 4,
            arrivals: [],
            entries: [
                { shopId: 'Y1', ownerId: 'dev', customers: 2, income: 500, moverCut: 200 },
                { shopId: 'P1', ownerId: 'chadia', customers: 1, income: 200, moverCut: 0 }
            ]
        }
        expect(movePayments('chadia', move)).toEqual([
            {
                kind: 'customers',
                playerId: 'dev',
                amount: 500,
                color: MarketColor.Yellow,
                count: 2
            },
            { kind: 'moverCut', playerId: 'dev', amount: -200, toPlayerId: 'chadia' },
            {
                kind: 'customers',
                playerId: 'chadia',
                amount: 200,
                color: MarketColor.Purple,
                count: 1
            }
        ])
    })

    it('pays an antique set by the cards its rank counts', () => {
        expect(antiqueSetPayments('bashir', { cards: [], rank: 1, payout: 525 })).toEqual([
            { kind: 'antiqueSet', playerId: 'bashir', amount: 525, cardCount: 4 }
        ])
    })

    it('reports the latest player action and the system actions that followed it', () => {
        const actions = [
            action(ActionType.MoveVisitors, ActionSource.User),
            action(ActionType.PlaceBid, ActionSource.User),
            action(ActionType.PlaceBid, ActionSource.System),
            action(ActionType.ResolveAuction, ActionSource.System)
        ]
        expect(latestTurnStep(actions)).toEqual(actions.slice(1))
        expect(latestTurnStep([])).toEqual([])
    })

    it('reports an antique set when the turn that completed it is confirmed', () => {
        const confirmed = latestTurnStep([
            action(ActionType.MoveVisitors, ActionSource.User),
            action(ActionType.ConfirmTurn, ActionSource.User),
            action(ActionType.CompleteAntiqueSet, ActionSource.System, {
                collectorId: 'bashir',
                metadata: { cards: [], rank: 1, payout: 525 }
            }),
            action(ActionType.EndTurn, ActionSource.System)
        ])
        expect(moneyReports(confirmed)).toEqual([
            {
                kind: 'antiqueSet',
                collectorId: 'bashir',
                result: { cards: [], rank: 1, payout: 525 },
                payments: [{ kind: 'antiqueSet', playerId: 'bashir', amount: 525, cardCount: 4 }]
            }
        ])
    })

    it('leaves out actions that moved no money', () => {
        const quietMove = action(ActionType.MoveVisitors, ActionSource.User, {
            playerId: 'chadia',
            fountainId: 8,
            direction: 'E',
            metadata: { destinationId: 9, entries: [], arrivals: [MarketColor.Red] }
        })
        expect(moneyReports([quietMove])).toEqual([])
    })

    it('counts every moved visitor, whether they entered a shop or walked on', () => {
        const move: MoveResult = {
            destinationId: 5,
            arrivals: [MarketColor.Red, MarketColor.Yellow, MarketColor.Green, MarketColor.Yellow],
            entries: [{ shopId: 'B1', ownerId: 'dev', customers: 2, income: 300, moverCut: 100 }]
        }
        expect(movedVisitors(move)).toBe('6 visitors')
        expect(movedVisitors({ ...move, arrivals: [MarketColor.Red], entries: [] })).toBe(
            '1 visitor'
        )
    })
})
