import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { describe1846Action } from './history.js'

const describeAction = describe1846Action({
    getPlayerName: (playerId) => `Player ${playerId}`,
    draftCardName: (id) => `Card ${id}`
})
const names = { companyName: (id: string) => `Initials ${id}`, place: (id: string) => id }
const shared = () => ({ text: 'shared' })

function recordedAction(
    source: ActionSource,
    type: string,
    fields: Record<string, unknown>
): GameAction {
    return { id: 'action:1', gameId: 'game', source, type, ...fields }
}
function userAction(type: string, fields: Record<string, unknown> = {}): GameAction {
    return recordedAction(ActionSource.User, type, { playerId: 'p1', ...fields })
}
function draftAction(type: string, fields: Record<string, unknown> = {}): GameAction {
    return userAction(type, { revealsInfo: true, ...fields })
}

describe('draft history', () => {
    it.each([
        ['the chooser', { cardId: 'MS' }],
        ['everyone else, who never receives the card', {}]
    ])('keeps an ordinary draft choice anonymous to %s', (_viewer, fields) => {
        expect(describeAction(draftAction('ChooseDraftCard', fields), names, shared)).toEqual({
            text: 'chose a private draft card'
        })
    })
    it.each([
        ['the chooser', { cardId: 'BIG4' }],
        ['everyone else, who never receives the card', {}]
    ])('shows %s what the final company went for against its face price', (_viewer, fields) => {
        expect(
            describeAction(
                draftAction('ChooseDraftCard', {
                    ...fields,
                    metadata: { finalCompany: { cardId: 'BIG4', price: 80 } }
                }),
                names,
                shared
            )
        ).toEqual({
            text: 'took the final company, Card BIG4',
            value: '$80',
            detail: 'reduced from $100'
        })
    })
    it('names the lowered price and who had to take the final company at its floor', () => {
        expect(
            describeAction(
                draftAction('PassFinalCompany', {
                    metadata: {
                        reducedOffer: { cardId: 'BIG4', price: 60 },
                        purchase: { cardId: 'BIG4', price: 60, playerId: 'p2' }
                    }
                }),
                names,
                shared
            )
        ).toEqual({
            text: 'passed Card BIG4; its price fell to $60',
            detail: 'Player p2 had to take it for $60'
        })
    })
})

describe('draft reveal history', () => {
    it('names who bought every private and for how much, noting a price below face', () => {
        expect(
            describeAction(
                recordedAction(ActionSource.System, 'RevealDraft', {
                    revealsInfo: true,
                    metadata: {
                        purchases: [
                            { playerId: 'p1', cardId: 'MS', price: 140 },
                            { playerId: 'p2', cardId: 'BIG4', price: 80 }
                        ]
                    }
                }),
                names,
                shared
            )
        ).toEqual({
            text: 'Private companies revealed and paid for',
            omitActor: true,
            important: true,
            detailLines: [
                'Player p1 bought Card MS for $140',
                'Player p2 bought Card BIG4 for $80, reduced from $100'
            ]
        })
    })
})

describe('two-player opening history', () => {
    it.each([
        [140, undefined],
        [120, 'reduced from $140']
    ])('shows a purchase at $%i against its face price', (price, detail) => {
        expect(
            describeAction(
                userAction('BuyOpeningCompany', { companyId: 'MS', expectedPrice: price }),
                names,
                shared
            )
        ).toEqual({ text: 'bought Card MS', value: `$${price}`, detail })
    })
})

describe('operating history', () => {
    it('names a company by its history initials outside the opening', () => {
        expect(
            describeAction(userAction('PlaceCWIStation', { companyId: 'BIG4' }), names, shared)
        ).toEqual({ text: 'Initials BIG4 placed its C&WI station in Chicago' })
    })
})
