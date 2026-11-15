import { describe, expect, it } from 'vitest'
import {
    Color,
    GameEngine,
    GameResult,
    GameStatus,
    PlayerStatus as SeatStatus,
    captureGameContinuation,
    type Game,
    type GameContinuation
} from '@tabletop/common'
import { Search, SearchSource } from './search.js'
import { SearchPlay, SearchResolve } from './searchResolve.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { ChronicleKeptFor } from '../model/chronicle.js'
import { ActionType } from '../definition/actions.js'
import type { ChronicleMapMetadata } from './chronicleMap.js'
import { WIN_KIND_OF_RULE } from '../model/ending.js'
import { Definition } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { FILLER, TENTS } from '../testing/cards.js'
import { wonTable, writeChronicleThrough } from '../testing/chronicle.js'
import { wholeWorld } from '../testing/chronicleWorld.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { reasonCannotPlaceCard } from '../util/cardPlay.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 7.4.3 and 9.2: from revision 31 Salt the Earth played during a Search leaves the modifier that Search uses at
// the site, so the salted site holds two cards at its capacity of 1 (Law 2.8.1, 5.1.4 only refuse plays to it). Law
// 8.3.2 keeps the sites the winner rules with their cards, and the next game opens on that map: the site keeps both
// cards and its capacity of 1, as it keeps any site's cards.

const SALT = 'denizen.discord.salt-the-earth'
const WELCOMING = 'denizen.hearth.welcoming-party'
const PLAINS = 'site.plains'
const LONGBOWS = 'denizen.order.longbows'

const sorted = (ids: readonly string[]) => [...ids].sort()
const hydrated = (state: OathProjectedState) => new HydratedOathGameState(structuredClone(state))

const PEOPLE = [
    { id: 'dana', name: 'Dana', userId: 'u-dana' },
    { id: 'rhys', name: 'Rhys', userId: 'u-rhys' },
    { id: 'chancellor', name: 'Ann', userId: 'u-ann' }
]

/** The finished game as the platform stores it. */
function sourceOf(previous: OathProjectedState): Game {
    return testGame([], {
        id: previous.gameId,
        status: GameStatus.Finished,
        hotseat: false,
        players: PEOPLE.map(({ id, name, userId }) => ({
            id,
            isHuman: true,
            userId,
            name,
            status: SeatStatus.Joined
        }))
    })
}

/** The next game of the chronicle, made by Continue: new ids for everyone. */
function nextGame(previous: OathProjectedState): Game {
    return testGame([], {
        id: 'game-2',
        status: GameStatus.WaitingToStart,
        hotseat: false,
        continuedFromGameId: previous.gameId,
        players: PEOPLE.map(({ name, userId }) => ({
            id: `next-${name.toLowerCase()}`,
            isHuman: true,
            userId,
            name,
            status: SeatStatus.Joined
        }))
    })
}

function opened(previous: OathProjectedState): OathProjectedState {
    const continuation = captureGameContinuation(
        sourceOf(previous),
        previous,
        Definition as never
    ) as GameContinuation<OathProjectedState>
    return new GameEngine(Definition.runtime).startGame(nextGame(previous), {
        masterSeed: '00000000000000000000000000000001',
        continuation
    }).initialState
}

/**
 * Dana, at the Plains (c1) with a warband, searches with Welcoming Party declared and plays Salt the Earth there:
 * from revision 31 Welcoming Party, in use, stays beside it.
 */
function salted(revision: OathRevision): { game: Game; state: OathProjectedState } {
    const game = testGame(['dana', 'rhys', 'chancellor'])
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [WELCOMING], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: { c1: PLAINS, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            table: {
                name: 'Thursday table',
                date: '2026-10-29',
                seatNames: Object.fromEntries(PEOPLE.map(({ id, name }) => [id, name]))
            }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [SALT, FILLER, TENTS]
    let state = s.dehydrate()
    state = engine.runNext(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(WELCOMING)]
        }),
        state,
        game
    ).updatedState
    state = engine.runNext(
        buildAction(SearchResolve, {
            playerId: 'dana',
            keptCardId: SALT,
            discardOrder: [FILLER, TENTS],
            play: SearchPlay.Site
        }),
        state,
        game
    ).updatedState
    return { game, state }
}

/** Dana wins with the salted site on the map, and the chronicle is written to its end; with its map record. */
function chronicled(revision: OathRevision): {
    final: OathProjectedState
    map?: ChronicleMapMetadata
} {
    const { game, state } = salted(revision)
    const won = wonTable(wholeWorld(hydrated(state)), {
        winnerPlayerId: 'dana',
        kind: WIN_KIND_OF_RULE['R-3.1'],
        rule: 'R-3.1'
    })
    const { final, actions } = writeChronicleThrough(game, won)
    const mapped = actions.find((action) => action.type === ActionType.ChronicleMap) as
        { metadata?: ChronicleMapMetadata } | undefined
    return { final, map: mapped?.metadata }
}

/** The slot the Plains lies in. */
function plainsSlot(state: OathProjectedState): string {
    const entry = Object.entries(state.siteCards).find(([, cardId]) => cardId === PLAINS)
    if (!entry) throw Error('the Plains is on the map')
    return entry[0]
}

describe('a salted site over its capacity, carried into the next game by the Chronicle (Law 8.3.2, 2.8.1)', () => {
    it('setup: from revision 31 the Plains holds Salt the Earth and Welcoming Party at capacity 1, and the Search keeps nothing in use', () => {
        const { state } = salted(OathRevision.EngineFixes26)
        const s = hydrated(state)
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([SALT, WELCOMING]))
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
        expect(state.searchModifiersInUse).toBeUndefined()
    })

    it('the chronicle keeps the site Dana rules with both cards and its capacity of 1', () => {
        const { final, map } = chronicled(OathRevision.EngineFixes26)
        expect(final.result).toBe(GameResult.Win)
        expect(final.canContinue).toBe(true)
        expect(map?.keptFor?.[PLAINS]).toBe(ChronicleKeptFor.Ruled)
        const slot = plainsSlot(final)
        expect(sorted(final.denizensBySite[slot] ?? [])).toEqual(sorted([SALT, WELCOMING]))
        expect(final.siteCapacityOverrides).toEqual({ [slot]: 1 })
        expect(final.searchModifiersInUse).toBeUndefined()
    })

    it('the next game opens on it: both cards at capacity 1, so a play there is refused as full', () => {
        const next = opened(chronicled(OathRevision.EngineFixes26).final)
        const s = hydrated(next)
        const slot = plainsSlot(next)
        expect(sorted(s.denizensAt(slot))).toEqual(sorted([SALT, WELCOMING]))
        expect(effectiveSiteCapacity(s, slot)).toBe(1)
        expect(next.searchModifiersInUse).toBeUndefined()
        // Dana, at the Plains in the next game, cannot play another card there.
        s.getPlayerState('next-dana').siteId = slot
        expect(reasonCannotPlaceCard(s, 'next-dana', LONGBOWS, SearchPlay.Site)).toBe(
            `site ${slot} is at its capacity of 1`
        )
    })

    it('control: at revision 30 Salt the Earth discards Welcoming Party, and the next game opens on the Plains with Salt the Earth alone', () => {
        const next = opened(chronicled(OathRevision.Chronicle).final)
        const s = hydrated(next)
        const slot = plainsSlot(next)
        expect(s.denizensAt(slot)).toEqual([SALT])
        expect(effectiveSiteCapacity(s, slot)).toBe(1)
    })
})
