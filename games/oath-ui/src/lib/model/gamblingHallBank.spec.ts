import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    ActionType,
    PowerQuestionKind,
    RerolledRollKind,
    Suit,
    type QuestionAnswer
} from '@tabletop/oath'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { gamblingHallUsed } from '$lib/testing/gamblingHallTable.js'
import { describeAction, rowActorOf } from './actionDescription.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

/** Shield, two shields, blank, doubling: (1 + 2) × 2 = 6. */
const SIX_FACES = [
    { shields: 1, doubling: false },
    { shields: 2, doubling: false },
    { shields: 0, doubling: false },
    { shields: 0, doubling: true }
]
const keep: QuestionAnswer = { kind: PowerQuestionKind.RerollDice, reroll: false }
const order: QuestionAnswer = { kind: PowerQuestionKind.GamblingHallBank, suit: Suit.Order }

describe('R-7.1.3-H2 — Gambling Hall’s bank, once the roll stands', () => {
    it('Dana is asked after the roll: its faces and total, and one gain per bank with favor, capped by the bank; none for the empty Beast bank', async () => {
        const session = await openSessionOn(gamblingHallUsed())
        expect(session.question.mine).toMatchObject({
            kind: PowerQuestionKind.GamblingHallBank,
            askedPlayerId: 'Dana',
            shields: 6,
            faces: SIX_FACES
        })
        expect(session.question.gamblingHallGains).toEqual([
            { suit: Suit.Discord, gain: 3 },
            { suit: Suit.Arcane, gain: 2 },
            { suit: Suit.Order, gain: 4 },
            { suit: Suit.Hearth, gain: 1 },
            { suit: Suit.Nomad, gain: 3 }
        ])
    })

    it('a tap sends that bank', async () => {
        const session = await openSessionOn(gamblingHallUsed())
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        await session.question.takeGamblingHallFavor(Suit.Order)
        expect(sent.mock.calls[0]?.[0]).toMatchObject({
            type: ActionType.AnswerQuestion,
            playerId: 'Dana',
            answer: order
        })
    })

    it('with Jinx, its reroll is asked first, with no gains; kept, the bank is asked with the same roll', async () => {
        const jinxed = await openSessionOn(gamblingHallUsed({ jinx: true }))
        expect(jinxed.question.mine).toMatchObject({
            kind: PowerQuestionKind.RerollDice,
            roll: { kind: RerolledRollKind.GamblingHallDice, shields: 6, faces: SIX_FACES }
        })
        expect(jinxed.question.gamblingHallGains).toEqual([])
        const kept = await openSessionOn(gamblingHallUsed({ jinx: true }, [keep]))
        expect(kept.question.mine).toMatchObject({
            kind: PowerQuestionKind.GamblingHallBank,
            shields: 6,
            faces: SIX_FACES
        })
        expect(kept.question.gamblingHallGains).toHaveLength(5)
    })

    it('one bank with favor: taken with no question', async () => {
        const session = await openSessionOn(gamblingHallUsed({ banks: { [Suit.Order]: 4 } }))
        expect(session.question.open).toBeUndefined()
        expect(session.gameState.getPlayerState('Dana').favor).toBe(2 + 4)
    })
})

describe('R-7.1.3-H2 — the History of Gambling Hall', () => {
    const names = {
        player: (playerId: string) => playerId,
        site: (slotId: string) => slotId,
        seats: ['Dana', 'Ann', 'Rhys']
    }
    const rows = (actions: ReturnType<typeof gamblingHallUsed>['actions']) =>
        actions.map((action) => [rowActorOf(action), describeAction(action, names, 'Ann')])

    it('asked: the use row reads the roll, the answer row the gain, as Hospitality’s bank reads', () => {
        expect(rows(gamblingHallUsed({}, [order]).actions)).toEqual([
            ['Dana', 'used Gambling Hall, placing 2 favor on it: rolled 6 shields'],
            ['Dana', 'gained 4 favor from the Order bank (Gambling Hall)']
        ])
    })

    it('one bank with favor: the use row carries the whole line', () => {
        expect(rows(gamblingHallUsed({ banks: { [Suit.Order]: 4 } }).actions)).toEqual([
            [
                'Dana',
                'used Gambling Hall, placing 2 favor on it: rolled 6 shields; gained 4 favor from the Order bank'
            ]
        ])
    })

    it('no bank with favor: the use row says nothing was gained', () => {
        expect(rows(gamblingHallUsed({ banks: {} }).actions)).toEqual([
            ['Dana', 'used Gambling Hall, placing 2 favor on it: rolled 6 shields; gained nothing']
        ])
    })

    it('with Jinx: the roll, the kept roll, then the gain', () => {
        expect(rows(gamblingHallUsed({ jinx: true }, [keep, order]).actions)).toEqual([
            [
                'Dana',
                'used Gambling Hall, placing 2 favor on it: rolled 6 shields; Jinx may reroll them'
            ],
            ['Dana', 'Jinx: kept the roll; rolled 6 shields'],
            ['Dana', 'gained 4 favor from the Order bank (Gambling Hall)']
        ])
    })
})
