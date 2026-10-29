import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    Color,
    assertExists,
    withoutActionPatches,
    type GameAction,
    type Visibility
} from '@tabletop/common'
import {
    ActionType,
    BoardSide,
    BuildOrRepairEdifice,
    OathRuntime,
    OpeningChancellor,
    ChooseChronicleSuit,
    ChooseHealStack,
    HydratedOathGameState,
    Suit,
    isAnswerChronicleCitizenship,
    isBuildOrRepairEdifice,
    isChooseChronicleSuit,
    isChooseHealStack,
    isChooseOath,
    type OathProjectedState
} from '@tabletop/oath'
import { buildAction, served, spectator } from '@tabletop/oath/testing'
import {
    carriedEntries,
    chronicleActionWords,
    chronicleRowsOf,
    openingRows,
    recordRowWords,
    shownInHistory
} from './chronicleHistory.js'
import { nameIds } from './names.js'
import {
    ANN,
    CRADLE_1,
    GAME_ONE_ENTRY,
    GAME_TWO_ENTRY,
    LONGBOWS,
    gameOneAt,
    gameOneVisionWon,
    gameThreeContinued,
    gameThreeOpen,
    gameTwoAt,
    gameTwoSkipped
} from '$lib/testing/chronicleTables.js'
import { played, setupTable, type PlayedTable } from '$lib/testing/sessionHarness.js'

/** The actions as `perspective` is served them; the host's whole. */
function servedActions(table: PlayedTable, perspective?: Visibility.Perspective): GameAction[] {
    if (!perspective) return table.actions
    const visibility = OathRuntime.visibility
    assertExists(visibility, 'Oath registers its visibility')
    return table.actions.map((action) =>
        visibility.actions.project(action, perspective, { config: {} })
    )
}

/**
 * The History's chronicle lines, oldest first, as `perspective` is served the actions, each from
 * its own record: a choice's sentence after its actor, a System Action's rows; framed rows in
 * brackets. Seats are their ids (each the reader's chip), cards their names.
 */
function lines(table: PlayedTable, perspective?: Visibility.Perspective): string[] {
    const out: string[] = []
    for (const action of servedActions(table, perspective)) {
        const rows = chronicleRowsOf(action)
        if (rows) {
            for (const row of rows) {
                if (row.kind === 'begins') out.push(`[${row.text}]`)
                else out.push(row.actorId ? `${row.actorId} ${row.text}` : row.text)
            }
            continue
        }
        const own = chronicleActionWords(action)
        if (own !== undefined && shownInHistory(action)) out.push(`${action.playerId} ${own}`)
    }
    return out.map((line) => nameIds(line, (slotId) => slotId))
}

/**
 * The rows of the History Step `matches` picks out: the System Actions that follow that action
 * before the next player's action, by their first words.
 */
function rowsOfStep(table: PlayedTable, matches: (action: GameAction) => boolean): string[] {
    const at = table.actions.findIndex(matches)
    expect(at, 'the action is in the log').toBeGreaterThanOrEqual(0)
    const after = table.actions.slice(at + 1)
    const next = after.findIndex((action) => action.source !== ActionSource.System)
    return (next < 0 ? after : after.slice(0, next))
        .flatMap((action) => chronicleRowsOf(action) ?? [])
        .map((row) => nameIds(row.text, (slotId) => slotId).split(/[;:.,]/)[0])
}

const views = (table: PlayedTable): Visibility.Perspective[] => [
    ...table.state.players.map((player) => ({
        kind: 'player' as const,
        playerId: player.playerId
    })),
    spectator
]

const KEPT_AND_GONE =
    'Kept Plains, Ancient City, Steppe and Deep Woods, ruled by dana. River, The Hidden Place, ' +
    'Wastes and 1 facedown site went back to the site deck; 2 denizens to the discards.'

describe('game 1 at its result, as the History tells it', () => {
    it('one line per step in the Law’s order; hidden cards counted, never named', () => {
        expect(lines(gameOneAt('result'))).toEqual([
            '[dana won as Usurper. The Chronicle begins.]',
            'dana swore the Oath of Protection: the Oathkeeper holds the most relics and banners.',
            'dana offered ann Citizenship.',
            'ann accepted Citizenship; their warbands at Ancient City and Steppe became dana’s.',
            KEPT_AND_GONE,
            'Cleared the map; moved Steppe and Deep Woods up the Provinces; dealt 4 facedown sites; flipped The Tribunal.',
            '3 Beast cards, 2 Nomad cards and 1 Discord card went into the world deck.',
            'Set 4 cards aside as the Dispossessed, unseen.',
            'The Grand Scepter went to the box; rhys’s relic and ann’s went back to the relic deck; ' +
                'placed a facedown relic at Ancient City, Steppe, Deep Woods and The Tribunal; ' +
                'dana’s 2 relics and the Reliquary’s 4 relics went on top of the relic deck.',
            'Rebuilt the world deck.',
            'dana wrote the story of Age I.'
        ])
    })

    it('every line is the same on each seat’s view and the spectator’s: each System Action is served whole', () => {
        for (const table of [gameOneAt('story'), gameOneAt('result'), gameTwoAt('heal')]) {
            const host = lines(table)
            for (const perspective of views(table)) {
                expect(lines(table, perspective), perspective.kind).toEqual(host)
                const system = table.actions.filter(
                    (action) => action.source === ActionSource.System
                )
                for (const action of servedActions({ ...table, actions: system }, perspective)) {
                    expect(action).toEqual(
                        withoutActionPatches(system.find((each) => each.id === action.id) ?? action)
                    )
                }
            }
        }
    })

    it('reads no State: the same lines from the actions alone, whatever state is on screen', () => {
        const table = gameOneAt('result')
        expect(lines({ ...table, state: gameOneAt('vow').state })).toEqual(lines(table))
    })

    it('a refusal reads so, and the warbands stay where they were', () => {
        expect(lines(gameOneAt('refused'))).toContain('ann refused Citizenship.')
    })

    it('stepping back: an earlier state shows none of a later action’s rows', () => {
        const offer = lines(gameOneAt('offer'))
        expect(offer.at(-1)).toBe(
            'dana swore the Oath of Protection: the Oathkeeper holds the most relics and banners.'
        )
        expect(offer.some((line) => line.startsWith('Kept'))).toBe(false)
    })
})

describe('the steps the rules settle: each its own System Action, in its History Step', () => {
    it('an Exile winner with no stop after a forced Vow: the start, the Vow and Map to Rebuild follow the win', () => {
        const table = gameOneVisionWon()
        expect(table.actions.map((action) => action.type)).toEqual([
            ActionType.ResolveWake,
            ActionType.ChronicleStart,
            ActionType.ChronicleForcedVow,
            ActionType.ChronicleFlipCitizens,
            ActionType.ChronicleMap,
            ActionType.ChronicleSettleSuit,
            ActionType.ChronicleAddCards,
            ActionType.ChronicleDispossess,
            ActionType.ChronicleRelics,
            ActionType.ChronicleRebuild
        ])
        expect(rowsOfStep(table, (action) => action.id === 'won')).toEqual([
            'dana won as Visionary',
            'swore the Oath of Devotion',
            expect.stringMatching(/^Kept /),
            'Cleared the map',
            '3 Beast cards',
            expect.stringMatching(/^Set \d+ cards aside as the Dispossessed$/),
            'The Grand Scepter went to the box',
            'Rebuilt the world deck'
        ])
        expect(lines(table)).toEqual([
            '[dana won as Visionary. The Chronicle begins.]',
            'dana swore the Oath of Devotion, by the Vision of Faith: the Oathkeeper holds the Darkest Secret.',
            expect.stringMatching(/^Kept /),
            expect.stringMatching(/^Cleared the map/),
            '3 Beast cards, 2 Nomad cards and 1 Discord card went into the world deck.',
            expect.stringMatching(/^Set \d+ cards aside as the Dispossessed, unseen\.$/),
            expect.stringMatching(/^The Grand Scepter went to the box/),
            'Rebuilt the world deck.'
        ])
    })

    it('a Citizen winner who builds and ties: the map after the build; the cards added in the suit’s row; the rest after it', () => {
        const table = played(gameTwoAt('build'), [
            buildAction(BuildOrRepairEdifice, {
                playerId: ANN,
                choice: { siteId: CRADLE_1, cardId: LONGBOWS }
            }),
            buildAction(ChooseChronicleSuit, { playerId: ANN, suit: Suit.Hearth })
        ])
        expect(rowsOfStep(table, isChooseOath)).toEqual([])
        expect(rowsOfStep(table, isBuildOrRepairEdifice)).toEqual([
            'Kept Plains',
            'Cleared the map'
        ])
        expect(rowsOfStep(table, isChooseChronicleSuit)).toEqual([
            'Set 5 cards aside as the Dispossessed',
            'The Grand Scepter went to the box',
            'Rebuilt the world deck'
        ])
        expect(lines(table)).toContain(
            'ann built Sprawling Rampart at Plains; Longbows went into the world deck.'
        )
        expect(lines(table)).toContain(
            'ann chose Hearth cards: 3 Hearth cards, 2 Beast cards and 1 Nomad card went into the world deck.'
        )
    })

    it('a tied heal: the stack’s row says what it took, and the Dispossessed to Rebuild follow it', () => {
        const table = played(gameTwoAt('heal'), [
            buildAction(ChooseHealStack, { playerId: ANN, suit: Suit.Beast })
        ])
        expect(lines(table)).toContain(
            'ann chose the stack of Beast cards: 5 Beast cards from the Dispossessed went into the world deck.'
        )
        expect(rowsOfStep(table, isChooseChronicleSuit)).toEqual([])
        expect(rowsOfStep(table, isChooseHealStack)).toEqual([
            'Set 5 cards aside as the Dispossessed',
            'The Grand Scepter went to the box',
            'Rebuilt the world deck'
        ])
    })

    it('a skipped story has no row', () => {
        const skipped = lines(gameTwoSkipped())
        expect(skipped.at(-1)).toBe('Rebuilt the world deck.')
        expect(skipped.some((line) => line.includes('story'))).toBe(false)
    })

    it('the map step follows the answer that completed the offers, in its History Step', () => {
        expect(rowsOfStep(gameOneAt('story'), isAnswerChronicleCitizenship)[0]).toBe('Kept Plains')
    })
})

describe('the record this game carried in', () => {
    it('game 3 carries games 1 and 2, newest first, each in the colour then played', () => {
        const state = new HydratedOathGameState(gameThreeOpen().state)
        expect(carriedEntries(state)).toEqual([GAME_TWO_ENTRY, GAME_ONE_ENTRY])
        expect(recordRowWords(GAME_ONE_ENTRY)).toBe('won as Usurper, under the Oath of Supremacy.')
        expect(recordRowWords(GAME_TWO_ENTRY)).toBe(
            'won as Successor, under the Oath of Protection.'
        )
    })

    it('a game’s own entry is never a record row: game 1 at its result carries nothing', () => {
        const state = new HydratedOathGameState(gameOneAt('result').state)
        expect(state.chronicleRecord).toHaveLength(1)
        expect(carriedEntries(state)).toEqual([])
    })

    it('a game carrying game 1 still lists it once its own entry is written', () => {
        const state = new HydratedOathGameState(gameOneAt('result').state)
        const own = state.chronicleRecord?.[0]
        expect(own).toBeDefined()
        if (own) state.chronicleRecord = [GAME_ONE_ENTRY, { ...own, gameNumber: 2 }]
        expect(carriedEntries(state)).toEqual([GAME_ONE_ENTRY])
    })

    it('a continued game 3 opens carrying games 2 and 1, newest first', () => {
        const state = new HydratedOathGameState(gameThreeContinued().state)
        expect(carriedEntries(state).map((entry) => entry.gameNumber)).toEqual([2, 1])
        expect(carriedEntries(state)[1]).toEqual(GAME_ONE_ENTRY)
    })
})

/** The opening rows as `viewerId` reads them, oldest first; each starts with its seat's id. */
const openingLines = (state: OathProjectedState, viewerId?: string) =>
    openingRows(new HydratedOathGameState(state), viewerId).map((row) => {
        expect(row.text.startsWith(`${row.playerId} `)).toBe(true)
        return row.text
    })

describe('R-1.7-H1, R-1.9-H1 — how a continued game’s seats were settled', () => {
    it('game 3 opens: Ann the Chancellor as game 2’s winner, then Dana and Bea in turn order', () => {
        expect(openingLines(gameThreeContinued().state)).toEqual([
            'ann is the Chancellor, as the winner of Age II.',
            'dana was dealt the blue board, Citizen side up.',
            'bea was dealt the yellow board, Exile side up.'
        ])
    })

    it('the winner’s Age is the game before this one, read from the record, also once this game’s own entry is written', () => {
        const state = structuredClone(gameThreeContinued().state)
        // The seat says why, not which game: the record's last entry is the game Ann won.
        expect(state.openingSeats?.chancellor).toEqual({
            playerId: 'ann',
            chosen: OpeningChancellor.Winner
        })
        expect(state.chronicleRecord?.map((entry) => entry.gameNumber)).toEqual([1, 2])
        const written = gameTwoSkipped().state.chronicle
        assertExists(written, 'game 2 has written its chronicle')
        expect(written.step).toBeUndefined()
        state.chronicle = structuredClone(written)
        state.chronicleRecord = [
            ...(state.chronicleRecord ?? []),
            { ...GAME_TWO_ENTRY, gameNumber: 3 }
        ]
        expect(openingLines(state)[0]).toBe('ann is the Chancellor, as the winner of Age II.')
    })

    it('the other ways a Chancellor is chosen, and a kept board', () => {
        const state = structuredClone(gameThreeContinued().state)
        state.openingSeats = {
            chancellor: { playerId: 'ann', chosen: OpeningChancellor.Citizen },
            boards: [{ playerId: 'dana', color: Color.Blue, side: BoardSide.Citizen, kept: true }]
        }
        expect(openingLines(state)).toEqual([
            'ann is the Chancellor: their board was on its Citizen side.',
            'dana kept the blue board, Citizen side up.'
        ])
        state.openingSeats = {
            chancellor: { playerId: 'ann', chosen: OpeningChancellor.Random },
            boards: []
        }
        expect(openingLines(state)).toEqual(['ann is the Chancellor, chosen at random.'])
    })

    it('the viewer’s own row agrees with their chip’s “you”', () => {
        const state = gameThreeContinued().state
        expect(openingLines(state, 'ann')[0]).toBe(
            'ann are the Chancellor, as the winner of Age II.'
        )
        expect(openingLines(state, 'dana')[1]).toBe(
            'dana were dealt the blue board, Citizen side up.'
        )
        const citizen = structuredClone(state)
        citizen.openingSeats = {
            chancellor: { playerId: 'ann', chosen: OpeningChancellor.Citizen },
            boards: []
        }
        expect(openingLines(citizen, 'ann')).toEqual([
            'ann are the Chancellor: your board was on its Citizen side.'
        ])
    })

    it('a first game has no opening rows', () => {
        expect(openingLines(setupTable().state)).toEqual([])
    })

    it('every seat and the spectator read the same rows', () => {
        const state = gameThreeContinued().state
        const views: Visibility.Perspective[] = [
            spectator,
            ...['ann', 'dana', 'bea'].map((playerId) => ({ kind: 'player' as const, playerId }))
        ]
        for (const view of views)
            expect(openingLines(served(state, view))).toEqual(openingLines(state))
    })
})
