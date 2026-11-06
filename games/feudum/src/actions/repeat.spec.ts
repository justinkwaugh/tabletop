import { describe, expect, it } from 'vitest'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { cardPlayOffers, playCard, reasonCardPlayRefused } from './cardPlay.js'

const HAND: ActionCardKind[] = ['repeat', 'move', 'explore', 'conquer']
const OTHER_HAND: ActionCardKind[] = ['move', 'explore', 'conquer', 'tax']

/** The first seat holds HAND and has forfeited the kinds named; the table is asking it again. */
function afterPlaying(...kinds: ActionCardKind[]): { table: Table; playerId: string } {
    const table = tableAtPlayingCards((id) => ({ cards: id === 'p1' ? HAND : OTHER_HAND }), 2)
    const [first, second] = table.order
    // p1 goes first or second by the shuffle: play p2's filler before p1's card as it falls.
    const playerId = 'p1'
    const other = first === playerId ? second : first
    for (const [index, kind] of kinds.entries()) {
        if (table.asked === other) {
            table.send(other, { type: ActionType.ForfeitCard, kind: OTHER_HAND[index] })
        }
        table.send(playerId, { type: ActionType.ForfeitCard, kind })
    }
    if (table.asked === other) {
        table.send(other, { type: ActionType.ForfeitCard, kind: OTHER_HAND[kinds.length] })
    }
    return { table, playerId }
}

describe('asRepeat', () => {
    it('R-3.15.1 replays a played x2 card: Repeat leaves the hand and records the replay', () => {
        const { table, playerId } = afterPlaying('move')
        const state = table.hydrated()
        const before = state.getPlayerState(playerId)
        const { saltpeter } = before.goods
        const { haversack } = state.supply

        expect(reasonCardPlayRefused(state, playerId, 'move', { asRepeat: 'repeat' })).toBe(
            undefined
        )
        const haversackSaltpeter = haversack.saltpeter
        playCard(state, playerId, 'move', 'regular', { asRepeat: 'repeat' })

        const after = state.getPlayerState(playerId)
        expect(after.hand).toEqual(['explore', 'conquer'])
        expect(after.handCount).toBe(2)
        expect(after.played).toEqual([
            { kind: 'move', use: 'forfeited' },
            { kind: 'repeat', use: 'regular', replayedKind: 'move' }
        ])
        expect(after.repeatUsed).toBe(true)
        expect(after.goods.saltpeter).toBe(saltpeter)
        expect(state.supply.haversack.saltpeter).toBe(haversackSaltpeter)
    })

    it('R-3.15.2 Déjà Vu replays any other played card for a saltpeter, to the haversack', () => {
        const { table, playerId } = afterPlaying('explore')
        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        const { saltpeter } = player.goods
        const haversackSaltpeter = state.supply.haversack.saltpeter

        expect(reasonCardPlayRefused(state, playerId, 'explore', { asRepeat: 'deja-vu' })).toBe(
            undefined
        )
        playCard(state, playerId, 'explore', 'regular', { asRepeat: 'deja-vu' })

        expect(player.played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'regular',
            replayedKind: 'explore',
            dejaVu: true
        })
        expect(player.goods.saltpeter).toBe(saltpeter - 1)
        expect(state.supply.haversack.saltpeter).toBe(haversackSaltpeter + 1)
        expect(player.repeatUsed).toBe(true)
    })

    it('R-3.15 records the use the replay made of the card', () => {
        const { table, playerId } = afterPlaying('move')
        const state = table.hydrated()
        playCard(state, playerId, 'move', 'special', { asRepeat: 'repeat' })
        expect(state.getPlayerState(playerId).played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'special',
            replayedKind: 'move'
        })
    })

    it('R-3.3 the card from the hand can still declare the second card', () => {
        const { table, playerId } = afterPlaying('move')
        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        player.pouch = 'sulfur'
        player.goods.sulfur -= 1
        playCard(state, playerId, 'move', 'regular', { asRepeat: 'repeat', secondCard: true })
        expect(state.flow.turn?.secondCard).toBe(true)
        expect(player.sequentialUsed).toBe(true)
    })

    it('R-3.15.1 refuses without Repeat in the hand, with the reason', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move', 'tax'] }), 2)
        const [first, second] = table.order
        table.send(first, { type: ActionType.ForfeitCard, kind: 'move' })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'move' })
        expect(reasonCardPlayRefused(table.hydrated(), first, 'move', { asRepeat: 'repeat' })).toBe(
            "Repeat isn't in your hand."
        )
    })

    it('R-3.15.1 refuses a second repeat in the round, with the reason', () => {
        const { table, playerId } = afterPlaying('move')
        const state = table.hydrated()
        state.getPlayerState(playerId).repeatUsed = true
        expect(reasonCardPlayRefused(state, playerId, 'move', { asRepeat: 'repeat' })).toBe(
            'You have already repeated a card this round.'
        )
    })

    it('R-3.15.1 refuses a card not played this round, with the reason', () => {
        const { table, playerId } = afterPlaying('move')
        expect(
            reasonCardPlayRefused(table.hydrated(), playerId, 'influence', { asRepeat: 'repeat' })
        ).toBe("You haven't played Influence this round.")
    })

    it('R-3.15.1 Repeat takes only x2; Déjà Vu names the other way, with the reason', () => {
        const { table, playerId } = afterPlaying('explore')
        expect(
            reasonCardPlayRefused(table.hydrated(), playerId, 'explore', { asRepeat: 'repeat' })
        ).toBe('Explore has no x2: only Déjà Vu replays it.')
    })

    it('R-3.15.2 Déjà Vu refuses without a saltpeter, with the reason', () => {
        const { table, playerId } = afterPlaying('explore')
        const state = table.hydrated()
        state.getPlayerState(playerId).goods.saltpeter = 0
        expect(reasonCardPlayRefused(state, playerId, 'explore', { asRepeat: 'deja-vu' })).toBe(
            'Déjà Vu needs a saltpeter.'
        )
    })

    it('R-3.15.2 Conquer and Defend never replay, in either mode', () => {
        const { table, playerId } = afterPlaying('conquer')
        const state = table.hydrated()
        for (const asRepeat of ['repeat', 'deja-vu'] as const) {
            expect(reasonCardPlayRefused(state, playerId, 'conquer', { asRepeat })).toBe(
                "Conquer can't be replayed."
            )
            expect(reasonCardPlayRefused(state, playerId, 'defend', { asRepeat })).toBe(
                "Defend can't be replayed."
            )
        }
    })

    it('R-3.13-H1 Repeat as the last card is no last Conquer', () => {
        const { table, playerId } = afterPlaying('move', 'explore', 'conquer')
        expect(
            reasonCardPlayRefused(table.hydrated(), playerId, 'move', { asRepeat: 'repeat' })
        ).toBe(undefined)
    })
})

describe('R-3.15 the offers (S23)', () => {
    it('lights the x2 card as a repeat, the other card as Déjà Vu, never Conquer or Defend', () => {
        const { table, playerId } = afterPlaying('move', 'explore', 'conquer')
        expect(cardPlayOffers(table.hydrated(), playerId).repeats).toEqual([
            { kind: 'move', mode: 'repeat' },
            { kind: 'explore', mode: 'deja-vu' }
        ])
    })

    it('without a saltpeter only the x2 card lights', () => {
        const { table, playerId } = afterPlaying('move', 'explore')
        const state = table.hydrated()
        state.getPlayerState(playerId).goods.saltpeter = 0
        expect(cardPlayOffers(state, playerId).repeats).toEqual([{ kind: 'move', mode: 'repeat' }])
    })

    it('R-3.2 a Repeat with nothing to replay shows only Forfeit', () => {
        const { table, playerId } = afterPlaying()
        const repeat = cardPlayOffers(table.hydrated(), playerId).cards.find(
            (card) => card.kind === 'repeat'
        )
        expect(repeat?.forfeitOnly).toBe(true)
    })

    it('R-3.2 Forfeiting Repeat itself is no repeat: it plays no replay and leaves the flag', () => {
        const { table, playerId } = afterPlaying()
        table.send(playerId, { type: ActionType.ForfeitCard, kind: 'repeat' })
        const seat = table.seat(playerId)
        expect(seat.played).toEqual([{ kind: 'repeat', use: 'forfeited' }])
        expect(seat.repeatUsed).toBe(false)
    })
})
