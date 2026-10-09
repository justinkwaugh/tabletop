import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus, PowerTiming, Suit, TradeOption, powerIndexOf, reliquarySlotId } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { tradeRows } from './tradeRows.js'

const BINDERS = 'denizen.hearth.book-binders'
const SEAT = 'denizen.order.council-seat'
const ASSASSIN = 'denizen.discord.assassin'
const HEARTH_ADVISERS = ['denizen.hearth.a-round-of-ale', 'denizen.hearth.armed-mob']
const SIGNAL = 'denizen.arcane.secret-signal'

const banks = (over: Partial<Record<Suit, number>> = {}): Record<Suit, number> => ({
    [Suit.Discord]: over[Suit.Discord] ?? 3,
    [Suit.Arcane]: over[Suit.Arcane] ?? 3,
    [Suit.Order]: over[Suit.Order] ?? 3,
    [Suit.Hearth]: over[Suit.Hearth] ?? 3,
    [Suit.Beast]: over[Suit.Beast] ?? 3,
    [Suit.Nomad]: over[Suit.Nomad] ?? 3
})

function site(player: Record<string, unknown> = {}, state: Record<string, unknown> = {}) {
    return testState(
        [
            testPlayer({
                playerId: 'p1',
                color: Color.Red,
                siteId: 'c1',
                secrets: 1,
                favor: 3,
                advisers: HEARTH_ADVISERS.map((cardId) => ({ cardId, faceUp: true })),
                ...player
            })
        ],
        {
            denizensBySite: { c1: [BINDERS, SEAT, ASSASSIN] },
            cardTokens: { [SEAT]: { favor: 1, secrets: 0 } },
            favorBank: banks({ [Suit.Discord]: 0 }),
            ...state
        }
    )
}

const gains = (rows: ReturnType<typeof tradeRows>) =>
    rows.map((row) => [row.cardId, row.choices.map((c) => [c.option, c.pay, c.gain])])

describe('the trades at your site (R-5.3.2)', () => {
    it('lists each tradeable card in the strip order with what each option costs and gains', () => {
        expect(gains(tradeRows(site(), 'p1', []))).toEqual([
            [
                BINDERS,
                [
                    [TradeOption.ForFavor, 1, 3],
                    [TradeOption.ForSecrets, 2, 2]
                ]
            ],
            [
                ASSASSIN,
                [
                    [TradeOption.ForFavor, 1, 0],
                    [TradeOption.ForSecrets, 2, 0]
                ]
            ]
        ])
    })

    it('leaves out a card the engine refuses, here one already carrying favor (R-7.1.2.a)', () => {
        expect(tradeRows(site(), 'p1', []).map((row) => row.cardId)).not.toContain(SEAT)
    })

    it('keeps a trade that gains nothing, its gain 0: the token placed still blocks the card', () => {
        const assassin = tradeRows(site(), 'p1', []).find((row) => row.cardId === ASSASSIN)
        // R-9.3 — an empty bank gives what it holds; no faceup Discord adviser gives no secret. Both are legal.
        expect(assassin?.choices).toEqual([
            { option: TradeOption.ForFavor, pay: 1, gain: 0, sideFavor: 0 },
            { option: TradeOption.ForSecrets, pay: 2, gain: 0, sideFavor: 0 }
        ])
    })

    it('gains no more favor than the bank holds', () => {
        const binders = tradeRows(site({}, { favorBank: banks({ [Suit.Hearth]: 1 }) }), 'p1', [])
        expect(binders[0].choices[0]).toMatchObject({ gain: 1 })
    })

    it('drops only the option the engine refuses', () => {
        const rows = tradeRows(site({ favor: 1 }), 'p1', [])
        expect(rows.map((row) => row.choices.map((c) => c.option))).toEqual([
            [TradeOption.ForFavor],
            [TradeOption.ForFavor]
        ])
    })

    it('counts the modifiers declared before the trade (R-7.4)', () => {
        const state = site({
            advisers: [{ cardId: SIGNAL, faceUp: true }]
        })
        const declared = [{ cardId: SIGNAL, powerIndex: powerIndexOf(SIGNAL, PowerTiming.Modifier) }]
        const binders = tradeRows(state, 'p1', declared).find((row) => row.cardId === BINDERS)
        // Secret Signal: "If you gain only one favor, gain one more favor."
        expect(binders?.choices[0]).toMatchObject({ option: TradeOption.ForFavor, gain: 2 })
    })
})

describe('Careless (R-6.6.2.a): a Trade for secrets also gains one favor', () => {
    const careless = (state: Record<string, unknown> = {}) =>
        site(
            { status: PlayerStatus.Chancellor },
            {
                chancellorPlayerId: 'p1',
                favorBank: banks(),
                reliquary: [0, 1, 3].map((space) => ({ slotId: reliquarySlotId(space) })),
                ...state
            }
        )
    const counts = (rows: ReturnType<typeof tradeRows>) =>
        rows.map((row) => [row.cardId, row.choices.map((c) => [c.option, c.gain, c.sideFavor])])

    it('counts the favor beside the secrets, with matching advisers (Hearth) and without (Discord)', () => {
        expect(counts(tradeRows(careless(), 'p1', []))).toEqual([
            [
                BINDERS,
                [
                    [TradeOption.ForFavor, 3, 0],
                    [TradeOption.ForSecrets, 1, 1]
                ]
            ],
            [
                ASSASSIN,
                [
                    [TradeOption.ForFavor, 2, 0],
                    [TradeOption.ForSecrets, 0, 1]
                ]
            ]
        ])
    })

    it('counts none from an empty bank (R-9.3)', () => {
        const rows = tradeRows(careless({ favorBank: banks({ [Suit.Discord]: 0 }) }), 'p1', [])
        expect(rows.find((row) => row.cardId === ASSASSIN)?.choices[1]).toMatchObject({
            option: TradeOption.ForSecrets,
            gain: 0,
            sideFavor: 0
        })
    })
})
