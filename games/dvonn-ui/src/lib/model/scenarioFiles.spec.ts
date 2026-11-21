import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, Color, GameEngine, type Game, type GameAction } from '@tabletop/common'
import {
    ActionType,
    DvonnGameStateValidator,
    DvonnRuntime,
    HydratedDvonnGameState,
    isPlacePiece,
    MachineState,
    type DvonnGameState
} from '@tabletop/dvonn'

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a position to start from, written by scripts/build-scenarios.mjs',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(join(FOLDER, name), 'utf8'))
            expect(DvonnGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions).toEqual([])
            expect([
                MachineState.MovingStacks,
                MachineState.PlacingPieces,
                MachineState.ChoosingColor
            ]).toContain(state.machineState)
            expect(state.activePlayerIds).toEqual(['player-1'])
        }
    )
})

const engine = new GameEngine(DvonnRuntime)
const ALICE = 'player-1'
const BOB = 'player-2'

function load(name: string): { game: Game; state: DvonnGameState } {
    return JSON.parse(readFileSync(join(FOLDER, `${name}.json`), 'utf8'))
}

function run(game: Game, state: DvonnGameState, fields: Record<string, unknown>) {
    const action: GameAction = {
        id: `m${state.actionCount}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId: state.activePlayerIds[0],
        type: ActionType.PlacePiece,
        ...fields
    }
    return engine.executeCanonicalAction({ game, state, action })
}

const colorOf = (state: DvonnGameState, playerId: string) =>
    state.players.find((player) => player.playerId === playerId)?.color

describe('what each scenario claims', () => {
    it('Setting the board: Alice puts down a black piece, then a white one, and Bob chooses', () => {
        const { game, state: start } = load('setting-the-board')
        const [first, last] = new HydratedDvonnGameState(start).board.vacantSpaces()
        const placed = run(game, start, { coords: first })
        const [black] = placed.processedActions
        expect(isPlacePiece(black) && black.metadata?.color).toBe(Color.Black)
        const done = run(game, placed.updatedState, { coords: last })
        const [white] = done.processedActions
        expect(isPlacePiece(white) && white.metadata?.color).toBe(Color.White)
        expect(done.updatedState.machineState).toBe(MachineState.ChoosingColor)
        expect(done.updatedState.activePlayerIds).toEqual([BOB])
    })

    it('Choosing a colour: Alice takes White or Black, and White moves first', () => {
        const { game, state } = load('choosing-a-colour')
        for (const color of [Color.White, Color.Black]) {
            const { updatedState } = run(game, state, { type: ActionType.ChooseColor, color })
            expect(colorOf(updatedState, ALICE)).toBe(color)
            expect(updatedState.machineState).toBe(MachineState.MovingStacks)
            expect(updatedState.activePlayerIds).toEqual([color === Color.White ? ALICE : BOB])
        }
    })
})
