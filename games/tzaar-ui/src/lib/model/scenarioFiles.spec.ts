import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine, type Game } from '@tabletop/common'
import {
    ActionType,
    HydratedTzaarGameState,
    MachineState,
    PIECE_KINDS,
    spaceFromName,
    spaceName,
    TzaarGameStateValidator,
    TzaarRuntime,
    type Capture,
    type Pass,
    type PlacePiece,
    type Stack,
    type TzaarGameState
} from '@tabletop/tzaar'

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')
const ALICE = 'player-1'
const BOB = 'player-2'

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))
const engine = new GameEngine(TzaarRuntime)

function load(name: string) {
    return JSON.parse(readFileSync(join(FOLDER, `${name}.json`), 'utf8'))
}

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a position to start from, written by scripts/build-scenarios.mjs',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(join(FOLDER, name), 'utf8'))
            expect(TzaarGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions).toEqual([])
            expect([MachineState.Capturing, MachineState.PlacingPieces]).toContain(
                state.machineState
            )
            expect(state.activePlayerIds).toEqual([ALICE])
        }
    )
})

// Plays moves named as "capture D1 D2", "stack C4 A2", "pass" or "place E4 tott" from a
// scenario, each by whoever's turn it is.
function play(name: string, ...moves: string[]): TzaarGameState {
    const { game, state: start }: { game: Game; state: TzaarGameState } = load(name)
    return moves.reduce((state: TzaarGameState, move, index) => {
        const [type, ...args] = move.split(' ')
        const base = {
            id: `m${index}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId: state.activePlayerIds[0]
        }
        const kind = PIECE_KINDS.find((candidate) => candidate === args[1])
        const action: Capture | Stack | Pass | PlacePiece =
            type === 'pass'
                ? { ...base, type: ActionType.Pass }
                : type === 'place' && kind !== undefined
                  ? { ...base, type: ActionType.PlacePiece, coords: spaceFromName(args[0]), kind }
                  : {
                        ...base,
                        type: type === 'capture' ? ActionType.Capture : ActionType.Stack,
                        from: spaceFromName(args[0]),
                        to: spaceFromName(args[1])
                    }
        return engine.executeCanonicalAction({ game, state, action }).updatedState
    }, start)
}

describe('what each scenario claims', () => {
    it('Two Tzaars left: one capture leaves a Tzaar; the second wins', () => {
        const one = play('two-tzaars-left', 'capture D1 D2')
        expect(one.machineState).toBe(MachineState.SecondMove)
        const both = play('two-tzaars-left', 'capture D1 D2', 'capture F1 F2')
        expect(both.machineState).toBe(MachineState.EndOfGame)
        expect(both.winningPlayerIds).toEqual([ALICE])
    })

    it('Bob cannot capture: stacking wins; passing lets Bob capture', () => {
        const stacked = play('bob-cannot-capture', 'capture C3 C4', 'stack C4 A2')
        expect(stacked.machineState).toBe(MachineState.EndOfGame)
        expect(stacked.winningPlayerIds).toEqual([ALICE])
        const passed = play('bob-cannot-capture', 'capture C3 C4', 'pass')
        expect(passed.activePlayerIds).toEqual([BOB])
        expect(
            new HydratedTzaarGameState(passed).canPlayerCapture(
                BOB,
                spaceFromName('B4'),
                spaceFromName('C4')
            )
        ).toBe(true)
    })

    it('No second move: the capture hands the turn to Bob', () => {
        const state = play('no-second-move', 'capture A1 A2')
        expect(state.machineState).toBe(MachineState.Capturing)
        expect(state.activePlayerIds).toEqual([BOB])
    })

    it('Covering a type: only A1 onto A2 or B1 and A5 onto A2 are offered', () => {
        const state = new HydratedTzaarGameState(play('covering-a-type', 'capture A3 A5'))
        const offered = state
            .stackings(ALICE)
            .map(({ from, to }) => `${spaceName(from)}-${spaceName(to)}`)
        expect(offered.sort()).toEqual(['A1-A2', 'A1-B1', 'A5-A2'])
    })

    it('Tall stacks: stacking D2 onto D3 makes 11', () => {
        const state = new HydratedTzaarGameState(
            play('tall-stacks', 'capture F1 F2', 'stack D2 D3')
        )
        expect(state.board.heightAt(spaceFromName('D3'))).toBe(11)
        expect(state.board.heightAt(spaceFromName('C4'))).toBe(11)
    })

    it('Placement ends: Alice and Bob place the last two, then Alice captures first', () => {
        const { state: start } = load('placement-ends')
        const hydrated = new HydratedTzaarGameState(start)
        const [first, last] = hydrated.board.vacantSpaces()
        const kindOf = (playerId: string) => hydrated.kindsInHand(playerId)[0]
        const state = play(
            'placement-ends',
            `place ${spaceName(first)} ${kindOf(ALICE)}`,
            `place ${spaceName(last)} ${kindOf(BOB)}`
        )
        expect(state.machineState).toBe(MachineState.Capturing)
        expect(state.activePlayerIds).toEqual([ALICE])
    })
})
