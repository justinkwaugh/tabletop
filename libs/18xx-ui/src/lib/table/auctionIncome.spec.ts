import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import type { CashPayment, OfferAuctionLot, PassAuction, ResolveAuction } from '@tabletop/18xx'
import { TestMarket } from '@tabletop/18xx/testing'
import { auctionHistory } from './auctionHistory.js'
import { historyDescription } from './historyDescription.js'
import { historyRounds } from './historyRounds.js'
import { historyStateFixture } from './history.fixture.js'
import { lastNotableStep } from './lastAction.js'

const payment = (playerId: string, amount: number): CashPayment => ({
    from: { kind: 'bank' },
    to: { kind: 'player', playerId },
    amount
})

function resolution(id: string, metadata: ResolveAuction['metadata']): ResolveAuction {
    return {
        id,
        gameId: 'history',
        source: ActionSource.System,
        type: 'ResolveAuction',
        metadata,
        undoPatch: []
    }
}

function describePayment(metadata: ResolveAuction['metadata']) {
    return historyDescription(
        resolution('income', metadata),
        historyStateFixture(),
        TestMarket,
        undefined,
        (id) => id.toUpperCase()
    )
}

it('keeps every private income payment on the card of the auction that needed it', () => {
    const lotId = 'concession'
    const offer: OfferAuctionLot = {
        id: 'offer',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'alex',
        type: 'OfferAuctionLot',
        lotId
    }
    const pass: PassAuction = {
        id: 'pass',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'blake',
        type: 'PassAuction'
    }
    const award = { lotId, playerId: 'alex', price: 160 }
    const [card] = auctionHistory(
        [
            offer,
            pass,
            resolution('first', { kind: 'income', payments: [payment('alex', 50)] }),
            resolution('second', { kind: 'income', payments: [payment('alex', 50)] }),
            resolution('award', { kind: 'award', award: { ...award, shares: [] } })
        ],
        [award]
    )
    expect(card).toMatchObject({
        kind: 'auction',
        income: [{ id: 'first' }, { id: 'second' }],
        award: { playerId: 'alex', price: 160 }
    })
})

it('names what each player received from a private income payment, across its rounds', () => {
    expect(
        describePayment({
            kind: 'income',
            payments: [
                payment('alex', 5),
                payment('blake', 10),
                payment('alex', 5),
                payment('blake', 10)
            ]
        })
    ).toEqual({ text: 'Private income', detail: 'ALEX $10 · BLAKE $20' })
})

it.each([
    ['paid nobody', { kind: 'income', payments: [] }],
    ['was recorded before its payments were', { kind: 'income' }]
] satisfies [string, ResolveAuction['metadata']][])(
    'leaves a resolution that %s routine',
    (_, metadata) => {
        expect(describePayment(metadata)).toMatchObject({
            text: 'Auction continued',
            routine: true
        })
    }
)

it('lists a waterfall auction’s private income as its own history entry', () => {
    const income = resolution('income', { kind: 'income', payments: [payment('alex', 5)] })
    const [round] = historyRounds([income], historyStateFixture())
    expect(round.entries).toEqual([{ kind: 'action', id: 'income', action: income }])
})

it('reports private income as part of the last step, unless it paid nobody', () => {
    const pass: PassAuction = {
        id: 'pass',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'blake',
        type: 'PassAuction'
    }
    const paid = resolution('paid', { kind: 'income', payments: [payment('alex', 5)] })
    const unpaid = resolution('unpaid', { kind: 'income', payments: [] })
    const routine = (action: GameAction) =>
        !!historyDescription(action, historyStateFixture(), TestMarket).routine
    expect(lastNotableStep([pass, paid, unpaid], routine)).toEqual([pass, paid])
})
