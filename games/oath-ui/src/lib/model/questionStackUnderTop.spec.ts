import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { MachineState, OathRevision, PlayerStatus, PowerQuestionKind, Region } from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import {
    INN,
    RANGERS,
    ROAR,
    SCOUTS,
    TENTS,
    WOLVES,
    landWardenOtherPileTable,
    landWardenPilgrimageTable,
    landWardenRoarKeptTable,
    landWardenRoarSecondTable,
    landWardenSecondDiscardsNothingTable,
    landWardenStackTable,
    plainStackTable
} from '$lib/testing/questionStackTable.js'
import { discardPositionLabel } from './discardOrder.js'
import type { QuestionDraft } from './questionDraft.js'

afterEach(() => {
    disposeSessions()
})

// Land Warden, R-7.3.3: from revision 33 the kept card's power's ordered discards go under what the second card
// already put on that pile, so the last card tapped is not on top there.

/** Each card's label under it, in the question's order. */
function labels(draft: QuestionDraft): string[] {
    return draft.stackCards.map((cardId) =>
        discardPositionLabel(cardId, draft.stackTapped, draft.stackCards, draft.stackUnderTop)
    )
}

async function draftOn(table: PlayedTable): Promise<QuestionDraft> {
    const session = await openSessionOn(table)
    expect(session.question.isMine).toBe(true)
    return session.question
}

function mark(state: PlayedTable['state']) {
    return state.pendingQuestions?.underSecondPlay
}

/** The question at the front of the queue. */
function openQuestion(table: PlayedTable) {
    return table.state.pendingQuestions?.queue[0]
}

describe('the last card of an order question, with Land Warden', () => {
    for (const revision of [OathRevision.EngineFixes28, OathRevision.EngineFixes29]) {
        it(`at revision ${revision}: Longbows second put Tents on the pile, so the last card tapped is "under top"`, async () => {
            const table = landWardenStackTable(revision)
            expect(openQuestion(table)).toMatchObject({
                kind: PowerQuestionKind.OrderDiscards,
                cardIds: [SCOUTS, INN],
                fromRegion: Region.Cradle
            })
            expect(table.state.vault?.discardPiles[Region.Provinces][0]).toBe(TENTS)
            const draft = await draftOn(table)
            expect(draft.stackUnderTop).toBe(true)
            expect(labels(draft)).toEqual(['', ''])
            draft.tapStack(INN)
            expect(labels(draft)).toEqual(['under top', 'bottom'])
        })
    }

    it('at revision 32: the answer goes on top, so the last card is "on top"', async () => {
        const table = landWardenStackTable(OathRevision.EngineFixes27)
        expect(mark(table.state)).toBeUndefined()
        const draft = await draftOn(table)
        expect(draft.stackUnderTop).toBe(false)
        draft.tapStack(INN)
        expect(labels(draft)).toEqual(['on top', 'bottom'])
    })

    it('with no Land Warden: "on top"', async () => {
        const draft = await draftOn(plainStackTable())
        expect(draft.stackCards).toEqual([SCOUTS, INN])
        expect(draft.stackUnderTop).toBe(false)
        draft.tapStack(SCOUTS)
        expect(labels(draft)).toEqual(['bottom', 'on top'])
    })

    it('Longbows second discarding nothing: "on top"', async () => {
        const table = landWardenSecondDiscardsNothingTable()
        expect(mark(table.state)?.questions).toBe(1)
        const draft = await draftOn(table)
        expect(draft.stackUnderTop).toBe(false)
        draft.tapStack(INN)
        expect(labels(draft)).toEqual(['on top', 'bottom'])
    })

    it('Riots kept asking for the Hinterland pile, while Tents went to the Provinces pile: "on top"', async () => {
        const table = landWardenOtherPileTable()
        expect(openQuestion(table)).toMatchObject({
            kind: PowerQuestionKind.OrderDiscards,
            fromRegion: Region.Provinces
        })
        expect(mark(table.state)).toMatchObject({ questions: 1, onTop: { [Region.Provinces]: 1 } })
        const draft = await draftOn(table)
        expect(draft.stackUnderTop).toBe(false)
    })

    it('Threatening Roar kept, discarding itself and the Wolves: "under top"', async () => {
        const draft = await draftOn(landWardenRoarKeptTable())
        expect(draft.stackCards).toEqual([ROAR, WOLVES])
        expect(draft.stackUnderTop).toBe(true)
        draft.tapStack(ROAR)
        expect(labels(draft)).toEqual(['bottom', 'under top'])
    })

    it('Threatening Roar second: Dazzle\'s question is "under top"; Roar\'s own, asked after it, is "on top"', async () => {
        const first = await draftOn(landWardenRoarSecondTable())
        expect(first.stackCards).toEqual([SCOUTS, INN])
        expect(first.stackUnderTop).toBe(true)
        disposeSessions()

        const table = landWardenRoarSecondTable({ answered: true })
        expect(openQuestion(table)).toMatchObject({ cardIds: [WOLVES, RANGERS] })
        const second = await draftOn(table)
        expect(second.stackUnderTop).toBe(false)
        second.tapStack(RANGERS)
        expect(labels(second)).toEqual(['on top', 'bottom'])
    })

    it("in Dana's own view, served as the platform sends it, the same label", async () => {
        const table = landWardenStackTable()
        const own = served(table.state, { kind: 'player', playerId: 'Dana' })
        const rhys = served(table.state, { kind: 'player', playerId: 'Rhys' })
        expect(own.pendingQuestions?.underSecondPlay).toEqual(mark(table.state))
        expect(rhys.pendingQuestions?.underSecondPlay).toEqual(mark(table.state))
        const draft = await draftOn({ state: own, actions: table.actions })
        expect(draft.stackUnderTop).toBe(true)
        draft.tapStack(INN)
        expect(labels(draft)).toEqual(['under top', 'bottom'])
    })

    it('a tap taken back leaves no label, and the last card is "under top" again once the order is complete', async () => {
        const table = landWardenStackTable()
        const session = await openSessionOn(table)
        const draft = session.question
        draft.tapStack(SCOUTS)
        expect(labels(draft)).toEqual(['bottom', 'under top'])
        await session.undo()
        expect(labels(draft)).toEqual(['', ''])
        expect(draft.stackUnderTop).toBe(true)
        draft.tapStack(INN)
        expect(labels(draft)).toEqual(['under top', 'bottom'])
    })
})

describe("Pilgrimage's order question", () => {
    it('with Riots second, which put the Wayside Inn on the Provinces pile: "under top"', async () => {
        const table = landWardenPilgrimageTable()
        expect(openQuestion(table)).toMatchObject({
            kind: PowerQuestionKind.OrderDrawnCards,
            region: Region.Provinces
        })
        expect(table.state.vault?.discardPiles[Region.Provinces]).toEqual([INN])
        const draft = await draftOn(table)
        expect(draft.stackCards).toHaveLength(2)
        expect(draft.stackUnderTop).toBe(true)
        draft.tapStack(draft.stackCards[0])
        expect(labels(draft)).toEqual(['bottom', 'under top'])
    })

    it('the same at revision 32: "on top"', async () => {
        const draft = await draftOn(landWardenPilgrimageTable(OathRevision.EngineFixes27))
        expect(draft.stackUnderTop).toBe(false)
        draft.tapStack(draft.stackCards[0])
        expect(labels(draft)).toEqual(['bottom', 'on top'])
    })

    it('plain, with no Land Warden: "on top"', async () => {
        const drawn = ['denizen.order.longbows', 'denizen.hearth.wayside-inn']
        const state = testState(
            [
                testPlayer({ playerId: 'Dana', color: Color.Red, siteId: 'c1' }),
                testPlayer({
                    playerId: 'Rhys',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c2'
                })
            ],
            {
                machineState: MachineState.PowerQuestion,
                chancellorPlayerId: 'Rhys',
                pendingQuestions: {
                    queue: [
                        {
                            kind: PowerQuestionKind.OrderDrawnCards,
                            cardId: 'denizen.nomad.pilgrimage',
                            askedPlayerId: 'Dana',
                            region: Region.Cradle,
                            cardCount: drawn.length,
                            cardIds: drawn
                        }
                    ],
                    askingPlayerId: 'Dana',
                    resumeMachineState: MachineState.ActPhase
                }
            }
        )
        openTurn(state, 'Dana')
        const draft = await draftOn(tableOf(state))
        expect(draft.stackUnderTop).toBe(false)
        draft.tapStack(drawn[1])
        expect(labels(draft)).toEqual(['on top', 'bottom'])
    })
})

describe('discardPositionLabel', () => {
    const cards = ['a', 'b', 'c']

    it('names only the last card "under top" when its cards go under others', () => {
        expect(cards.map((id) => discardPositionLabel(id, ['b', 'c'], cards, true))).toEqual([
            'under top',
            'bottom',
            '2nd'
        ])
        expect(cards.map((id) => discardPositionLabel(id, ['b', 'c'], cards))).toEqual([
            'on top',
            'bottom',
            '2nd'
        ])
    })

    it('leaves an order still open as it was', () => {
        expect(cards.map((id) => discardPositionLabel(id, ['b'], cards, true))).toEqual([
            '',
            'bottom',
            ''
        ])
    })
})
