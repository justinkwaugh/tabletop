import type * as Type from 'typebox'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { MoveWarbands } from '../actions/moveWarbands.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { Travel } from '../actions/travel.js'
import { describe, expect, it } from 'vitest'
import { Color, GameStatus, Prng, shuffle } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { Region } from '../model/oathEnums.js'
import { ALL_SITE_IDS } from '../data/sites.js'
import type { OathProjectedState } from '../model/gameState.js'
import { testGame } from '../testing/game.js'
import { twoSeatActPhase } from '../testing/tables.js'

function action<T extends Type.TSchema>(schema: T, fields: Partial<Type.Static<T>>) {
    return buildAction(schema, { id: 'dup-1', ...fields })
}

describe('double-submit of one action', () => {
    it('a stale NONZERO index is rejected outright before any mutation', () => {
        const game = testGame(['p1', 'p2'])
        const state = twoSeatActPhase('p1')
        let current = engine.run(
            action(Travel, { playerId: 'p1', siteId: 'c2', index: 0, id: 'a1' }),
            state,
            game
        ).updatedState
        const second = action(Travel, {
            playerId: 'p1',
            siteId: 'p1',
            index: 1,
            id: 'a2'
        })
        current = engine.run(second, current, game).updatedState
        expect(current.actionCount).toBe(2)

        // Oath sets no `simultaneousGroupId`, so the engine's index tolerance never applies.
        expect(() => engine.run(second, current, game)).toThrow(/index/i)
    })

    // Skipped: the platform's GameEngine tests `action.index` by truthiness, so index 0 is unchecked.
    it.skip('an index-0 action is index-checked like any other', () => {
        const game = testGame(['p1', 'p2'])
        const state = twoSeatActPhase('p1')
        const travel = action(Travel, {
            playerId: 'p1',
            siteId: 'c2',
            index: 0
        })
        const first = engine.run(travel, state, game)
        expect(first.updatedState.actionCount).toBe(1)
        expect(() => engine.run(travel, first.updatedState, game)).toThrow(/index/i)
    })

    // Skipped: the platform's GameEngine tests `action.index` by truthiness, so index 0 is unchecked.
    it.skip('a replayed index-0 action that is still legal does not apply twice', () => {
        const game = testGame(['p1', 'p2'])
        const state = twoSeatActPhase('p1')
        state.players[0].warbandsOnBoard = { [Color.Purple]: 2 }
        state.warbandsBySite = { c1: { [Color.Purple]: 1 } }

        const move = action(MoveWarbands, {
            playerId: 'p1',
            move: { kind: WarbandMoveKind.BoardToSite },
            color: Color.Purple,
            count: 1,
            index: 0
        })
        const first = engine.run(move, state, game)
        expect(first.updatedState.warbandsBySite['c1'][Color.Purple]).toBe(2)

        expect(() => engine.run(move, first.updatedState, game)).toThrow(/index/i)
        expect(first.updatedState.warbandsBySite['c1'][Color.Purple]).toBe(2)
    })

    it('a replayed action with a CORRECTED index is refused by legality, not by any id dedup', () => {
        const game = testGame(['p1', 'p2'])
        const state = twoSeatActPhase('p1')
        const end = action(EndActPhase, {
            playerId: 'p1',
            index: state.actionCount
        })

        const first = engine.run(end, state, game)
        expect(first.updatedState.machineState).toBe(MachineState.RestPhase)

        // Id dedup lives in the store, not the engine.
        const replay = action(EndActPhase, {
            playerId: 'p1',
            index: first.updatedState.actionCount
        })
        expect(() => engine.run(replay, first.updatedState, game)).toThrow()
    })
})

describe('replay determinism (what checksum verification and client rebuild rest on)', () => {
    it('identical sequences from identical state produce identical states and checksums', () => {
        const game = testGame(['p1', 'p2'])
        const initial = twoSeatActPhase('p1')

        function play(): OathProjectedState {
            let state = structuredClone(initial)
            state = engine.run(
                action(Travel, { playerId: 'p1', siteId: 'c2', index: 0, id: 'r-1' }),
                state,
                game
            ).updatedState
            state = engine.run(
                action(EndActPhase, { playerId: 'p1', index: 1, id: 'r-2' }),
                state,
                game
            ).updatedState
            return state
        }

        const a = play()
        const b = play()
        expect(a.actionChecksum).toBe(b.actionChecksum)
        expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })

    it('the original state object is not mutated by engine.run (snapshot safety)', () => {
        const game = testGame(['p1', 'p2'])
        const initial = twoSeatActPhase('p1')
        const before = JSON.stringify(initial)
        engine.run(
            action(Travel, { playerId: 'p1', siteId: 'c2', index: 0 }),
            initial,
            game
        )
        expect(JSON.stringify(initial)).toBe(before)
    })
})

describe('R-X.3 — undo bounds', () => {
    it.todo(
        'R-X.3 undo bounds hold across simultaneous groups and the admin bypass'
    )
})

describe('R-1.1 — the faceup-site deal is counted on the saved public stream', () => {
    it('the next public draw does not repeat the entropy that dealt the sites', () => {
        const game = testGame(['p1', 'p2', 'p3'], { status: GameStatus.WaitingToStart })
        const state = engine.startGame(game, { masterSeed: '0123456789abcdef0123456789abcdef' }).initialState
        const dealt = Object.values(Region).map((region) => state.siteCards?.[state.map[region][0]])
        const replay = [...ALL_SITE_IDS]
        shuffle(replay, new Prng(structuredClone(state.prng)).random)
        expect(replay.slice(0, 3)).not.toEqual(dealt)
    })
})
