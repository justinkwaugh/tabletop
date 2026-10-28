import { describe, expect, it } from 'vitest'
import type { GameAction, Visibility } from '@tabletop/common'
import {
    BuildOrRepairEdifice,
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
    chronicleRowsAfter,
    chronicleWordsOf,
    recordRowWords,
    shownInHistory
} from './chronicleHistory.js'
import { endingActionIndex } from './majorEvents.js'
import { nameIds } from './names.js'
import {
    ANN,
    CRADLE_1,
    GAME_ONE_ENTRY,
    GAME_TWO_ENTRY,
    LONGBOWS,
    gameOneAt,
    gameOneVisionWon,
    gameThreeOpen,
    gameTwoAt,
    gameTwoSkipped
} from '$lib/testing/chronicleTables.js'
import { played, type PlayedTable } from '$lib/testing/sessionHarness.js'

/**
 * The History's chronicle lines, oldest first, as `view` serves the state: each chronicle action's
 * sentence after its actor, then the rows placed after that action; framed rows in brackets. Seats
 * are their ids (each the reader's chip), cards their names.
 */
function lines(table: PlayedTable, view: OathProjectedState = table.state): string[] {
    const state = new HydratedOathGameState(view)
    const words = chronicleWordsOf(state)
    const after = chronicleRowsAfter(table.actions, endingActionIndex(table.actions), state)
    const out: string[] = []
    for (const action of table.actions) {
        const own = chronicleActionWords(action, words)
        if (own !== undefined && shownInHistory(action)) out.push(`${action.playerId} ${own}`)
        for (const row of after.get(action.id) ?? []) {
            if (row.kind === 'begins') out.push(`[${row.text}]`)
            else out.push(row.actorId ? `${row.actorId} ${row.text}` : row.text)
        }
    }
    return out.map((line) => nameIds(line, (slotId) => slotId))
}

/** The rows placed after the one action `matches` picks out, by their first words. */
function rowsAfter(table: PlayedTable, matches: (action: GameAction) => boolean): string[] {
    const state = new HydratedOathGameState(table.state)
    const after = chronicleRowsAfter(table.actions, endingActionIndex(table.actions), state)
    const action = table.actions.find(matches)
    expect(action, 'the action is in the log').toBeDefined()
    return (after.get(action?.id ?? '') ?? []).map(
        (row) => nameIds(row.text, (slotId) => slotId).split(/[;:.,]/)[0]
    )
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
            'dana wrote the story of game 1.'
        ])
    })

    it('every line is the same on each seat’s view and the spectator’s', () => {
        for (const table of [gameOneAt('story'), gameOneAt('result'), gameTwoAt('heal')]) {
            const host = lines(table)
            for (const perspective of views(table)) {
                expect(lines(table, served(table.state, perspective)), perspective.kind).toEqual(
                    host
                )
            }
        }
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

describe('where the rows the rules settle go (writeChronicleFrom’s order)', () => {
    it('an Exile winner with no stop after a forced Vow: the start, the Vow and Map to Rebuild follow the win', () => {
        const table = gameOneVisionWon()
        const state = new HydratedOathGameState(table.state)
        const after = chronicleRowsAfter(table.actions, 0, state)
        expect([...after.keys()]).toEqual(['won'])
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
        expect(rowsAfter(table, isChooseOath)).toEqual([])
        expect(rowsAfter(table, isBuildOrRepairEdifice)).toEqual(['Kept Plains', 'Cleared the map'])
        expect(rowsAfter(table, isChooseChronicleSuit)).toEqual([
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
        expect(rowsAfter(table, isChooseChronicleSuit)).toEqual([])
        expect(rowsAfter(table, isChooseHealStack)).toEqual([
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

    it('the answer that ran the map is the map’s anchor', () => {
        expect(rowsAfter(gameOneAt('story'), isAnswerChronicleCitizenship)[0]).toBe('Kept Plains')
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
})
