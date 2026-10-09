import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    CampaignTargetKind,
    IMPERIAL_WARBANDS,
    MachineState,
    PowerQuestionKind,
    WarbandMoveKind
} from '@tabletop/oath'
import { describeAction, type HistoryNames } from './actionDescription.js'
import { seatParts, seatsById, slotLabel } from './names.js'
import { tokenParts } from './tokenText.js'

const ALICE = 'p1'
const BOB = 'Qx7_pL2mWb9-Rk4tYc1nZ'
const CASS = 'p3'
const DEED_WRITER = 'denizen.hearth.deed-writer'

const NAMES: Record<string, string> = { [ALICE]: 'Alice', [BOB]: 'Bob', [CASS]: 'Cass' }
const names: HistoryNames = {
    player: (playerId) => NAMES[playerId] ?? playerId,
    site: slotLabel,
    seats: [ALICE, BOB, CASS]
}

function action(fields: { type: ActionType; playerId: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

/** A History row after its actor's chip, as `ActionDescription` draws it for `viewerId`. */
function row(fields: Parameters<typeof action>[0], viewerId?: string, seats: HistoryNames = names) {
    return tokenParts(describeAction(action(fields), seatsById(seats), viewerId), {
        warbands: true,
        seats: { names: seats, viewerId }
    })
}

const text = (value: string) => ({ kind: 'text', text: value })
const chip = (playerId: string, possessive = false) => ({ kind: 'seat', playerId, possessive })

// The actor, the seat the row names, a third seat, and a spectator.
const READERS = [ALICE, BOB, CASS, undefined]

describe('a History row names every seat inside it by its chip', () => {
    it('an exchange partner, for every reader', () => {
        const proposed = {
            type: ActionType.UseActionPower,
            playerId: ALICE,
            cardId: DEED_WRITER,
            powerIndex: 0,
            metadata: { summary: `proposed a binding exchange to ${BOB}` }
        }
        for (const reader of READERS) {
            expect(row(proposed, reader)).toEqual([
                text('used Deed Writer: proposed a binding exchange to '),
                chip(BOB)
            ])
        }
    })

    it("an answer to an exchange keeps the proposer's possessive on the chip", () => {
        const accepted = {
            type: ActionType.AnswerQuestion,
            playerId: BOB,
            answer: { kind: PowerQuestionKind.Exchange, accept: true },
            metadata: {
                cardId: DEED_WRITER,
                kind: PowerQuestionKind.Exchange,
                summary: `accepted ${ALICE}'s exchange`,
                resumeMachineState: MachineState.ActPhase,
                last: true
            }
        }
        for (const reader of READERS) {
            expect(row(accepted, reader)).toEqual([
                text('Deed Writer: accepted '),
                chip(ALICE, true),
                text(' exchange')
            ])
        }
    })

    it('a move asked of another seat, and the seat the warbands go to', () => {
        const asked = {
            type: ActionType.MoveWarbands,
            playerId: ALICE,
            move: { kind: WarbandMoveKind.GiveToImperial, otherPlayerId: BOB },
            owner: IMPERIAL_WARBANDS,
            count: 2,
            metadata: { awaitingConsentOf: BOB }
        }
        for (const reader of READERS) {
            expect(row(asked, reader)).toEqual([
                text('asked '),
                chip(BOB, true),
                text(' permission to move '),
                { kind: 'warband', count: 2, imperial: true, words: 'Imperial warbands' },
                text(' to '),
                chip(BOB)
            ])
        }
    })

    it('the defender a Campaign names', () => {
        const campaign = {
            type: ActionType.Campaign,
            playerId: ALICE,
            defender: { kind: 'player', playerId: BOB },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 3,
            metadata: { awaitingAllies: true }
        }
        for (const reader of READERS) {
            expect(row(campaign, reader)).toEqual([
                text('campaigned against '),
                chip(BOB),
                text(' for their pawn and '),
                { kind: 'favor', count: undefined },
                text(' — Citizens are asked to join the defence')
            ])
        }
    })

    it("a warband's owner stays inside its token, named in its words", () => {
        const moved = {
            type: ActionType.MoveWarbands,
            playerId: ALICE,
            move: { kind: WarbandMoveKind.BoardToSite },
            owner: BOB,
            count: 2
        }
        for (const reader of READERS) {
            expect(row(moved, reader)).toEqual([
                text('moved '),
                { kind: 'warband', count: 2, imperial: false, words: "of Bob's warbands" },
                text(' from board to site')
            ])
        }
    })
})

describe("the reader's own seat is their chip, which reads “you”", () => {
    it('a verb after it agrees with “you”; for anyone else it does not', () => {
        const sacrificed = {
            type: ActionType.CampaignSacrifice,
            playerId: ALICE,
            sacrifice: 2,
            metadata: { sacrificed: 2, attackerVictorious: true, awaitingLossesOf: BOB }
        }
        const won = [
            text('sacrificed '),
            { kind: 'warband', count: 2, imperial: false, words: 'warbands' },
            text(' and won the battle — '),
            chip(BOB)
        ]
        expect(row(sacrificed, BOB)).toEqual([...won, text(" choose the defending side's losses")])
        expect(row(sacrificed, CASS)).toEqual([...won, text(" chooses the defending side's losses")])
        expect(row(sacrificed, undefined)).toEqual([...won, text(" chooses the defending side's losses")])
    })

    it("an engine summary's “is” and “your own” stay as today, around the reader's chip", () => {
        const used = (summary: string) => ({
            type: ActionType.UseActionPower,
            playerId: ALICE,
            cardId: DEED_WRITER,
            powerIndex: 0,
            metadata: { summary }
        })
        expect(row(used(`${BOB} is the Chancellor`), BOB)).toEqual([
            text('used Deed Writer: '),
            chip(BOB),
            text(' are the Chancellor')
        ])
        const killed = used(`killed 2 warbands on ${ALICE}'s board`)
        expect(row(killed, ALICE)).toEqual([
            text('used Deed Writer: killed '),
            { kind: 'warband', count: 2, imperial: false, words: 'warbands' },
            text(' on '),
            chip(ALICE, true),
            text(' own board')
        ])
        expect(row(killed, BOB)).toEqual([
            text('used Deed Writer: killed '),
            { kind: 'warband', count: 2, imperial: false, words: 'warbands' },
            text(' on their own board')
        ])
    })
})

describe('a card name is never a chip', () => {
    it('even where a seat is called by it', () => {
        const named: HistoryNames = { ...names, player: (playerId) => (playerId === BOB ? 'Deed Writer' : names.player(playerId)) }
        const proposed = {
            type: ActionType.UseActionPower,
            playerId: ALICE,
            cardId: DEED_WRITER,
            powerIndex: 0,
            metadata: { summary: `proposed a binding exchange to ${BOB}` }
        }
        for (const reader of READERS) {
            expect(row(proposed, reader, named)).toEqual([
                text('used Deed Writer: proposed a binding exchange to '),
                chip(BOB)
            ])
        }
    })

    it('only a whole id is a seat, so one that begins another is not split from it', () => {
        expect(seatParts("ab-c gave ab's relic to -x_", ['ab', 'ab-c', '-x_'], undefined)).toEqual([
            chip('ab-c'),
            text(' gave '),
            chip('ab', true),
            text(' relic to '),
            chip('-x_')
        ])
    })
})
