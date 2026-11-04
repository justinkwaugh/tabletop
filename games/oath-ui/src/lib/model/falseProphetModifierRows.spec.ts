import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, type GameAction, type Visibility } from '@tabletop/common'
import {
    AnswerQuestion,
    HydratedAnswerQuestion,
    IMPERIAL_WARBANDS,
    OathRevision,
    OathVisibility,
    PlayerStatus,
    PowerChoiceKind,
    PowerQuestionKind,
    PowerTiming,
    Region,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    powerIndexOf,
    type ModifierUse,
    type QuestionAnswer
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    required,
    served,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    played,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { describeAction } from './actionDescription.js'
import { withOptionPick } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

// False Prophet: "If it is ever discarded, kill the warband and play or discard the Vision as if you had searched."
// From revision 32 the question holds the Search's "Cards" rows above its buttons (the Cracked Horn, Bracken),
// each button carries Forced Labor's toll under its word, and with no favor for the toll it offers only "Discard".

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const FALSE_PROPHET = 'denizen.discord.false-prophet'
const HORN = 'relic.cracked-horn'
const BRACKEN = 'denizen.beast.bracken'
const FORCED_LABOR = 'denizen.order.forced-labor'
const FAITH = 'vision.faith'
const CONQUEST = 'vision.conquest'
const FILLER = 'denizen.order.wrestlers'

const FIXED = OathRevision.EngineFixes27
const BEFORE = OathRevision.EngineFixes26

const modifier = (cardId: string): number => powerIndexOf(cardId, PowerTiming.Modifier)
const HORN_USE: ModifierUse = { cardId: HORN, powerIndex: modifier(HORN) }
const BRACKEN_KEY = { cardId: BRACKEN, powerIndex: modifier(BRACKEN) }

interface Scene {
    revision?: OathRevision
    favor?: number
    forcedLabor?: boolean
}

/**
 * Round 3, Dana's Act Phase. Dana (an Exile) at the Plains (c1) has the Vision of Faith revealed, with one of Rhys's
 * warbands on it. Rhys (an Exile) has False Prophet and Bracken faceup, holds the Cracked Horn, and stands at the
 * River (c2), which Ann, the Chancellor, rules with Forced Labor there. Dana searches the world deck and reveals the
 * Vision of Conquest, so Faith is discarded and Rhys is asked.
 */
function scene({ revision = FIXED, favor = 1, forcedLabor = true }: Scene = {}): PlayedTable {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                revealedVisionId: FAITH,
                warbandsInPersonalBank: { dana: 10 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c2',
                favor,
                secrets: 2,
                supply: 5,
                relicIds: [HORN],
                advisers: [FALSE_PROPHET, BRACKEN].map((cardId) => ({ cardId, faceUp: true })),
                warbandsInPersonalBank: { rhys: 10 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 2,
                secrets: 1,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: 'ann',
            round: 3,
            denizensBySite: { c1: [], c2: forcedLabor ? [FORCED_LABOR] : [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 }, c2: { [IMPERIAL_WARBANDS]: 2 } },
            warbandsOnCards: { [FAITH]: { rhys: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [CONQUEST, FILLER]
    s.worldDeckVisions = 1
    return played(tableOf(s), [
        buildAction(Search, { playerId: 'dana', drawFrom: SearchSource.WorldDeck }),
        buildAction(SearchResolve, {
            playerId: 'dana',
            keptCardId: CONQUEST,
            discardOrder: [],
            play: SearchPlay.RevealedVision
        })
    ])
}

const rhys: Visibility.Perspective = { kind: 'player', playerId: 'rhys' }

/** Rhys's own view of the scene: the hotseat puts Rhys, the asked seat, on screen. */
const ownView = (table: PlayedTable): PlayedTable => ({
    state: served(table.state, rhys),
    actions: table.actions
})

async function asked(table: PlayedTable) {
    const session = await openSessionOn(table)
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { session, draft: session.question, sent }
}

const listed = (session: OathGameSession): string[] =>
    (session.question.visionRows?.listed ?? []).map((power) => power.cardId).sort()

function tapCard(session: OathGameSession, cardId: string): void {
    const rows = required(session.question.visionRows, 'the question has its rows')
    const power = required(
        rows.listed.find((p) => p.cardId === cardId),
        `${cardId} is listed`
    )
    rows.declare(power, !rows.isDeclared(power))
}

/** Bracken's "To:" pile and its Top / Bottom, tapped as the picker taps them. */
function pickBracken(session: OathGameSession, region: Region, bottom: boolean) {
    const rows = required(session.question.visionRows, 'the question has its rows')
    const legal = rows.choicesOf(
        required(
            rows.listed.find((p) => p.cardId === BRACKEN),
            'Bracken'
        )
    )
    let picks = rows.picksOf(BRACKEN_KEY)
    legal.forEach((choice, index) => {
        const pick = choice.options.findIndex((option) =>
            option.kind === PowerChoiceKind.Region
                ? option.region === region
                : option.kind === PowerChoiceKind.Yes && bottom
        )
        if (pick >= 0) picks = withOptionPick(picks, choice, index, pick)
    })
    rows.setPicks(BRACKEN_KEY, picks)
}

const ALL_PLAYS = [SearchPlay.RevealedVision, SearchPlay.Adviser, SearchPlay.Discard]

describe("False Prophet's question holds the Search's cards (revision 32)", () => {
    for (const [name, view] of [
        ['the table', (t: PlayedTable) => t],
        ["Rhys's own view", ownView]
    ] as const) {
        it(`on ${name}: the Cracked Horn and Bracken are listed, nothing in use, and every play offered`, async () => {
            const { session, draft } = await asked(view(scene()))
            expect(draft.question?.kind).toBe(PowerQuestionKind.PlayOrDiscardVision)
            expect(listed(session)).toEqual([BRACKEN, HORN])
            const rows = required(draft.visionRows, 'the question has its rows')
            expect(rows.isDeclared(HORN_USE)).toBe(false)
            expect(rows.isDeclared(BRACKEN_KEY)).toBe(false)
            expect(draft.visionRowsComplete).toBe(true)
            expect(draft.visionPlays).toEqual(ALL_PLAYS)
        })

        it(`on ${name}: once the Horn is in use Bracken is hidden, and the other way round`, async () => {
            const { session } = await asked(view(scene()))
            tapCard(session, HORN)
            expect(listed(session)).toEqual([HORN])
            tapCard(session, HORN)
            expect(listed(session)).toEqual([BRACKEN, HORN])
            tapCard(session, BRACKEN)
            expect(listed(session)).toEqual([BRACKEN])
            pickBracken(session, Region.Cradle, true)
            expect(listed(session)).toEqual([BRACKEN])
        })
    }

    it('each play carries the toll: 1 favor to Ann (Forced Labor)', async () => {
        const { draft } = await asked(scene())
        expect(draft.visionTolls).toEqual([{ cardId: FORCED_LABOR, payeeId: 'ann' }])
        expect(draft.visionTollsUnpaid).toEqual([])
    })

    it('without Forced Labor there is no toll', async () => {
        const { draft } = await asked(scene({ forcedLabor: false }))
        expect(draft.visionTolls).toEqual([])
    })

    it('the Horn in use: "Discard" sends it, and the engine accepts the answer', async () => {
        const { session, draft, sent } = await asked(scene())
        tapCard(session, HORN)
        expect(draft.visionPlays).toEqual(ALL_PLAYS)
        await draft.playVision(SearchPlay.Discard)
        const answer = sent.mock.calls[0]?.[0]
        expect(answer).toEqual({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            play: SearchPlay.Discard,
            modifiers: [HORN_USE]
        })
        expect(
            HydratedAnswerQuestion.reasonCannotAnswer(
                session.gameState,
                'rhys',
                required(answer, 'an answer was sent')
            )
        ).toBeUndefined()
    })

    it('Bracken in use: the plays wait for its pile and its side, then send them', async () => {
        const { session, draft, sent } = await asked(scene())
        tapCard(session, BRACKEN)
        expect(draft.visionRowsComplete).toBe(false)
        pickBracken(session, Region.Cradle, true)
        expect(draft.visionRowsComplete).toBe(true)
        await draft.playVision(SearchPlay.Discard)
        expect(sent.mock.calls[0]?.[0]).toEqual({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            play: SearchPlay.Discard,
            modifiers: [
                {
                    ...BRACKEN_KEY,
                    choices: [
                        { kind: PowerChoiceKind.Region, region: Region.Cradle },
                        { kind: PowerChoiceKind.Yes }
                    ]
                }
            ]
        })
    })

    it('nothing in use: the answer sends no card', async () => {
        const { draft, sent } = await asked(scene())
        await draft.playVision(SearchPlay.Discard)
        expect(sent.mock.calls[0]?.[0]).toEqual({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            play: SearchPlay.Discard
        })
    })

    it('Undo takes back the card put in use', async () => {
        const { session, draft } = await asked(scene())
        tapCard(session, HORN)
        expect(draft.back()).toBe(true)
        expect(draft.visionRows?.isDeclared(HORN_USE)).toBe(false)
        expect(listed(session)).toEqual([BRACKEN, HORN])
    })
})

describe('with no favor for Forced Labor', () => {
    it('no rows, no toll, and only "Discard"; the unpaid toll names the line', async () => {
        const { draft } = await asked(scene({ favor: 0 }))
        expect(draft.visionRows).toBeUndefined()
        expect(draft.visionTolls).toEqual([])
        expect(draft.visionTollsUnpaid).toEqual([FORCED_LABOR])
        expect(draft.visionPlays).toEqual([SearchPlay.Discard])
    })
})

describe('before revision 32', () => {
    it('no rows and no toll; every play offered as before', async () => {
        const { draft } = await asked(scene({ revision: BEFORE }))
        expect(draft.visionRows).toBeUndefined()
        expect(draft.visionTolls).toEqual([])
        expect(draft.visionTollsUnpaid).toEqual([])
        expect(draft.visionPlays).toEqual(ALL_PLAYS)
    })

    it('with no favor, every play is still offered', async () => {
        const { draft } = await asked(scene({ revision: BEFORE, favor: 0 }))
        expect(draft.visionPlays).toEqual(ALL_PLAYS)
    })
})

describe('History: where the Vision went, the cards and the toll', () => {
    function answered(table: PlayedTable, answer: QuestionAnswer): PlayedTable {
        return played(table, [buildAction(AnswerQuestion, { playerId: 'rhys', answer })])
    }

    async function linesFor(t: Scene, modifiers?: ModifierUse[], play = SearchPlay.Discard) {
        const after = answered(scene(t), {
            kind: PowerQuestionKind.PlayOrDiscardVision,
            play,
            ...(modifiers ? { modifiers } : {})
        })
        const record: GameAction = required(after.actions.at(-1), 'the answer is recorded')
        const session = await openSessionOn(after)
        const seen = (playerId: string) =>
            describeAction(
                OathVisibility.actions.project(record, { kind: 'player', playerId }),
                session.historyNames,
                playerId
            )
        return { rhys: seen('rhys'), dana: seen('dana') }
    }

    const DIED = 'False Prophet: 1 warband on Vision of Faith died; discarded it'

    it('the Horn: under the world deck (Cracked Horn); paid Ann 1 favor (Forced Labor)', async () => {
        const lines = await linesFor({}, [HORN_USE])
        const line = `${DIED} under the world deck (Cracked Horn); paid ann 1 favor (Forced Labor)`
        expect(lines).toEqual({ rhys: line, dana: line })
    })

    it('Bracken: to the bottom of the cradle discard pile (Bracken)', async () => {
        const lines = await linesFor({}, [
            {
                ...BRACKEN_KEY,
                choices: [
                    { kind: PowerChoiceKind.Region, region: Region.Cradle },
                    { kind: PowerChoiceKind.Yes }
                ]
            }
        ])
        const line = `${DIED} to the bottom of the cradle discard pile (Bracken); paid ann 1 favor (Forced Labor)`
        expect(lines).toEqual({ rhys: line, dana: line })
    })

    it('no favor: to the provinces discard pile; no favor for Forced Labor', async () => {
        const lines = await linesFor({ favor: 0 })
        const line = `${DIED} to the provinces discard pile; no favor for Forced Labor`
        expect(lines).toEqual({ rhys: line, dana: line })
    })

    it('nothing in use: the usual pile, unsaid, and the toll', async () => {
        const lines = await linesFor({})
        expect(lines.rhys).toBe(`${DIED}; paid ann 1 favor (Forced Labor)`)
    })

    it('control: before revision 32 the line is as it was', async () => {
        const lines = await linesFor({ revision: BEFORE })
        expect(lines.rhys).toBe(DIED)
    })
})
