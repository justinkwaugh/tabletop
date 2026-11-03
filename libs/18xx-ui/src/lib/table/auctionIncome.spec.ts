import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import type { EighteenXXState, OfferAuctionLot, ResolveAuction } from '@tabletop/18xx'
import { TestMarket } from '@tabletop/18xx/testing'
import { auctionHistory } from './auctionHistory.js'
import { historyAuctionIncome } from './historyCash.js'
import { historyDescription } from './historyDescription.js'
import { historyStates } from './historyStates.js'
import { historyStateFixture } from './history.fixture.js'

const lotId = 'concession'

function recorded<T extends GameAction>(action: Omit<T, 'gameId'>): T {
    return { ...action, gameId: 'history' } as T
}

function income(id: string, cashBefore: [number, number]): ResolveAuction {
    return recorded<ResolveAuction>({
        id,
        source: ActionSource.System,
        type: 'ResolveAuction',
        metadata: { kind: 'income' },
        undoPatch: cashBefore.map((value, index) => ({
            op: 'replace' as const,
            path: `/cash/${index + 1}/amount`,
            value
        }))
    })
}

function forcedSale() {
    const state: EighteenXXState = {
        ...historyStateFixture(),
        cash: [
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            { owner: { kind: 'player', playerId: 'alex' }, amount: 160 },
            { owner: { kind: 'player', playerId: 'blake' }, amount: 60 }
        ]
    }
    const actions: GameAction[] = [
        recorded<OfferAuctionLot>({
            id: 'offer',
            source: ActionSource.User,
            playerId: 'alex',
            type: 'OfferAuctionLot',
            lotId,
            undoPatch: []
        }),
        recorded({
            id: 'pass',
            source: ActionSource.User,
            playerId: 'blake',
            type: 'PassAuction',
            undoPatch: []
        }),
        income('first', [60, 20]),
        income('second', [110, 40]),
        recorded<ResolveAuction>({
            id: 'award',
            source: ActionSource.System,
            type: 'ResolveAuction',
            metadata: {
                kind: 'award',
                award: { lotId, playerId: 'alex', price: 160, shares: [] }
            },
            undoPatch: []
        })
    ]
    return { state, actions }
}

it('keeps every private income payment on the card of the auction that needed it', () => {
    const { actions } = forcedSale()
    const [card] = auctionHistory(actions, [{ lotId, playerId: 'alex', price: 160 }])
    expect(card).toMatchObject({
        kind: 'auction',
        income: [{ id: 'first' }, { id: 'second' }],
        award: { playerId: 'alex', price: 160 }
    })
})

it('names what each player received from a private income payment', () => {
    const { state, actions } = forcedSale()
    const income = historyAuctionIncome(actions, historyStates(actions, state))
    expect([...income.keys()]).toEqual(['first', 'second'])
    const payment = actions.find((action) => action.id === 'first')!
    expect(
        historyDescription(
            payment,
            state,
            TestMarket,
            undefined,
            (id) => id.toUpperCase(),
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            income.get('first')
        )
    ).toEqual({ text: 'Private income', detail: 'ALEX $50 · BLAKE $20' })
})

it('leaves out a player a private income payment gave nothing', () => {
    const { state, actions } = forcedSale()
    const unpaid = [...actions]
    unpaid[3] = income('second', [110, 60])
    const paid = historyAuctionIncome(unpaid, historyStates(unpaid, state))
    expect(paid.get('second')).toEqual([
        { owner: { kind: 'player', playerId: 'alex' }, amount: 50 }
    ])
})

it('keeps a resolution that paid nobody out of the history', () => {
    const { state, actions } = forcedSale()
    const unpaid = [...actions]
    unpaid[3] = income('second', [160, 60])
    const paid = historyAuctionIncome(unpaid, historyStates(unpaid, state))
    expect(paid.get('second')).toBeUndefined()
    const action = unpaid[3]
    expect(historyDescription(action, state, TestMarket)).toEqual({
        text: 'Auction continued',
        detail: '',
        important: false,
        routine: true
    })
})
