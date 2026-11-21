import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine, type Game } from '@tabletop/common'
import {
    ActionType,
    HydratedLyngkGameState,
    LyngkGameStateValidator,
    LyngkRuntime,
    MachineState,
    type LyngkGameState,
    type PlacePiece
} from '@tabletop/lyngk'

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)(
        '%s is a position to start from, written by scripts/build-scenarios.mjs',
        (name) => {
            const { game, state, actions } = JSON.parse(readFileSync(join(FOLDER, name), 'utf8'))
            expect(LyngkGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions).toEqual([])
            expect([MachineState.TakingTurn, MachineState.PlacingPieces]).toContain(
                state.machineState
            )
            expect(state.activePlayerIds).toEqual(['player-1'])
        }
    )
})

const engine = new GameEngine(LyngkRuntime)

// Places a piece of the first colour left on each empty point in turn, by whoever's turn it is.
function placeAll(name: string): { order: string[]; state: LyngkGameState } {
    const { game, state: start }: { game: Game; state: LyngkGameState } = JSON.parse(
        readFileSync(join(FOLDER, `${name}.json`), 'utf8')
    )
    const order: string[] = []
    let state = start
    for (const coords of new HydratedLyngkGameState(start).board.vacantPoints()) {
        const [playerId] = state.activePlayerIds
        order.push(playerId)
        const action: PlacePiece = {
            id: `p${order.length}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: ActionType.PlacePiece,
            coords,
            color: new HydratedLyngkGameState(state).colorsLeft()[0]
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return { order, state }
}

describe('what each scenario claims', () => {
    it('Taking turns: Alice, Bob and Alice place the last three, then Bob moves first', () => {
        const { order, state } = placeAll('taking-turns')
        expect(order).toEqual(['player-1', 'player-2', 'player-1'])
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['player-2'])
    })

    it('I set, you start: Alice places the last two, then Bob moves first', () => {
        const { order, state } = placeAll('i-set-you-start')
        expect(order).toEqual(['player-1', 'player-1'])
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['player-2'])
    })
})
