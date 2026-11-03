import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    ActionType,
    HydratedAnswerQuestion,
    HydratedUseActionPower,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerQuestionKind,
    PowerTiming,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    powerIndexOf,
    type HydratedOathGameState,
    type ModifierUse
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    placeEdifice,
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
import type { OathGameSession } from './session.svelte.js'

// From revision 33 the engine refuses a declared Search modifier that cannot act on a play "as if you searched":
// Great Spire (it changes a Search's draw), New Growth and Crop Rotation (they act on a play to a site), Welcoming
// Party (it acts when a denizen is played). The rows of Oracle's use and of False Prophet's question already hid
// them, so nothing a player sees changes: each row listed is accepted, and each card hidden is now refused, on the
// table and on the player's own projected view alike.

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ORACLE = 'denizen.nomad.oracle'
const FALSE_PROPHET = 'denizen.discord.false-prophet'
const HORN = 'relic.cracked-horn'
const SPIRE = 'edifice.arcane.great-spire'
const WELCOMING_PARTY = 'denizen.hearth.welcoming-party'
const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const FORCED_LABOR = 'denizen.order.forced-labor'
const INN = 'denizen.hearth.wayside-inn'
const FILLER = 'denizen.order.wrestlers'
const SUPREMACY = 'vision.supremacy'
const FAITH = 'vision.faith'
const CONQUEST = 'vision.conquest'

const FIXED = OathRevision.EngineFixes28
const BEFORE = OathRevision.EngineFixes27

const use = (cardId: string): ModifierUse => ({
    cardId,
    powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
})

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
const rhys: Visibility.Perspective = { kind: 'player', playerId: 'rhys' }

const views = (table: PlayedTable, seat: Visibility.Perspective): [string, PlayedTable][] => [
    ['the table', table],
    ["the seat's own view", { state: served(table.state, seat), actions: table.actions }]
]

// --- Oracle's use ---

/** Dana on turn at c1 with Oracle and Great Spire there, the Cracked Horn, and three Search cards faceup. */
function oracleTable(revision: OathRevision): PlayedTable {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 6,
                relicIds: [HORN],
                advisers: [WELCOMING_PARTY, NEW_GROWTH, CROP_ROTATION].map((cardId) => ({
                    cardId,
                    faceUp: true
                }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
        ],
        {
            oathRevision: revision,
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [ORACLE], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [INN, SUPREMACY]
    placeEdifice(s, 'c1', SPIRE)
    return tableOf(s)
}

async function oracleRows(table: PlayedTable): Promise<OathGameSession> {
    const session = await openSessionOn(table)
    vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.UseActionPower)
    return session
}

function oracleListed(session: OathGameSession): string[] {
    const oracle = required(
        session.actionPowers.powers.find((p) => p.cardId === ORACLE),
        'Oracle is listed'
    )
    return (session.actionPowers.modifierRows(oracle)?.listed ?? []).map((p) => p.cardId).sort()
}

const oracleReason = (state: HydratedOathGameState, cardId: string) =>
    HydratedUseActionPower.reasonCannotUse(
        state,
        'dana',
        ORACLE,
        powerIndexOf(ORACLE, PowerTiming.Action),
        [],
        [use(cardId)]
    )

const HIDDEN_ON_ORACLE = [SPIRE, WELCOMING_PARTY, NEW_GROWTH, CROP_ROTATION]

describe("Oracle's row at revision 33: the same rows, and each card it hides is refused", () => {
    for (const [name, table] of views(oracleTable(FIXED), dana)) {
        it(`on ${name}: only the Cracked Horn is listed, and the engine accepts it`, async () => {
            const session = await oracleRows(table)
            expect(oracleListed(session)).toEqual([HORN])
            expect(oracleReason(session.gameState, HORN)).toBeUndefined()
        })

        it(`on ${name}: Great Spire, Welcoming Party, New Growth and Crop Rotation are refused`, async () => {
            const session = await oracleRows(table)
            for (const cardId of HIDDEN_ON_ORACLE)
                expect(oracleReason(session.gameState, cardId), cardId).toBeDefined()
        })
    }

    it('before revision 33 the row is the same, and the engine accepts each card alone', async () => {
        const session = await oracleRows(oracleTable(BEFORE))
        expect(oracleListed(session)).toEqual([HORN])
        for (const cardId of HIDDEN_ON_ORACLE)
            expect(oracleReason(session.gameState, cardId), cardId).toBeUndefined()
    })
})

// --- False Prophet's question ---

/**
 * Dana's Search reveals the Vision of Conquest, so their Vision of Faith, with Rhys's warband on it, is discarded and
 * Rhys is asked. Rhys holds the Cracked Horn and has False Prophet, Welcoming Party and New Growth faceup; at the
 * River (c2), which Ann, the Chancellor, rules, are Forced Labor and Great Spire.
 */
function prophetTable(revision: OathRevision): PlayedTable {
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
                favor: 1,
                secrets: 2,
                supply: 5,
                relicIds: [HORN],
                advisers: [FALSE_PROPHET, WELCOMING_PARTY, NEW_GROWTH].map((cardId) => ({
                    cardId,
                    faceUp: true
                })),
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
            denizensBySite: { c1: [], c2: [FORCED_LABOR], p1: [], h1: [] },
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
    placeEdifice(s, 'c2', SPIRE)
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

async function askedRhys(table: PlayedTable): Promise<OathGameSession> {
    const session = await openSessionOn(table)
    vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return session
}

const prophetListed = (session: OathGameSession): string[] =>
    (session.question.visionRows?.listed ?? []).map((power) => power.cardId).sort()

const prophetReason = (state: HydratedOathGameState, play: SearchPlay, cardId: string) =>
    HydratedAnswerQuestion.reasonCannotAnswer(state, 'rhys', {
        kind: PowerQuestionKind.PlayOrDiscardVision,
        play,
        modifiers: [use(cardId)]
    })

// Rhys's three faceup advisers are at the limit, so the facedown adviser play is not offered.
const OFFERED_PLAYS = [SearchPlay.RevealedVision, SearchPlay.Discard]
const HIDDEN_ON_PROPHET = [SPIRE, WELCOMING_PARTY, NEW_GROWTH]

describe("False Prophet's question at revision 33: the same rows and plays, and each card it hides is refused", () => {
    for (const [name, table] of views(prophetTable(FIXED), rhys)) {
        it(`on ${name}: only the Cracked Horn is listed, the same plays are offered, and the engine accepts the Horn`, async () => {
            const session = await askedRhys(table)
            expect(session.question.question?.kind).toBe(PowerQuestionKind.PlayOrDiscardVision)
            expect(prophetListed(session)).toEqual([HORN])
            expect(session.question.visionPlays).toEqual(OFFERED_PLAYS)
            expect(prophetReason(session.gameState, SearchPlay.Discard, HORN)).toBeUndefined()
        })

        it(`on ${name}: Great Spire, Welcoming Party and New Growth are refused on each play offered`, async () => {
            const session = await askedRhys(table)
            for (const play of OFFERED_PLAYS)
                for (const cardId of HIDDEN_ON_PROPHET)
                    expect(
                        prophetReason(session.gameState, play, cardId),
                        `${cardId} on ${play}`
                    ).toBeDefined()
        })
    }

    it('before revision 33 the rows and plays are the same', async () => {
        const session = await askedRhys(prophetTable(BEFORE))
        expect(prophetListed(session)).toEqual([HORN])
        expect(session.question.visionPlays).toEqual(OFFERED_PLAYS)
        expect(prophetReason(session.gameState, SearchPlay.Discard, SPIRE)).toBeUndefined()
        expect(prophetReason(session.gameState, SearchPlay.Discard, NEW_GROWTH)).toBeUndefined()
    })
})
