import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameProgress,
    PlayerStatus,
    assertExists,
    reportGameProgress,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { PALACE_COLORS, startingStock } from '../components/pieces.js'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'
import { legalActions } from '../testing/legalActions.js'
import { Definition } from './definition.js'
import { MedinaRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(MedinaRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number) {
    return MedinaRuntime.initializer.initializeGame(
        {
            id: 'medina-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 23,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function seededChooser(seed: number) {
    let value = seed
    return (length: number): number => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value % length
    }
}

// Buildings outnumber everything else as legal moves, so choose the kind of piece first.
function chooseMove(state: MedinaProjectedState, choose: (length: number) => number) {
    const moves = legalActions(state)
    const kinds = [...new Set(moves.map((move) => move.type))]
    const kind = kinds[choose(kinds.length)]
    const ofKind = moves.filter((move) => move.type === kind)
    return ofKind[choose(ofKind.length)]
}

function play(count: number, seed: number) {
    const game = createGame(count)
    let { initialState: state } = engine.startGame(game, { masterSeed })
    const choose = seededChooser(seed)
    const actions: GameAction[] = []
    let step = 0
    while (state.machineState !== MachineState.EndOfGame) {
        expect(step++).toBeLessThan(1000)
        const [playerId] = state.activePlayerIds
        assertExists(playerId, 'A running game has an acting player')
        const move = chooseMove(state, choose)
        const before = state
        const { updatedState, processedActions } = engine.executeCanonicalAction({
            game,
            state,
            action: {
                id: `a${step}`,
                gameId: game.id,
                source: ActionSource.User,
                playerId,
                ...move
            }
        })
        actions.push(...processedActions)
        expect(MedinaRuntime.canonicalStateValidator.Check(updatedState)).toBe(true)
        expect(updatedState.actionCount).toBeGreaterThan(before.actionCount)
        const progress = reportGameProgress(MedinaRuntime, updatedState)
        if (progress) {
            expect(Value.Check(GameProgress, progress)).toBe(true)
        }
        state = updatedState
    }
    return { game, state, actions }
}

describe.each([2, 3, 4])('a whole game with %i players', (count) => {
    it.each([1, 2, 3])('reaches a valid result with seed %i', (seed) => {
        const { state, actions } = play(count, seed)
        expect(() => validateGameResult(state)).not.toThrow()
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        expect(state.activePlayerIds).toEqual([])
        const hydrated = new HydratedMedinaGameState(state)
        for (const player of hydrated.players) {
            expect(hydrated.isPlaceable(player.playerId)).toBe(false)
        }
        const finals = MedinaRuntime.scoring.finalScores(state)
        const best = Math.max(...Object.values(finals))
        expect(state.winningPlayerIds.every((id) => finals[id] === best)).toBe(true)
        const stock = startingStock(count)
        expect(hydrated.buildings.length).toBeLessThanOrEqual(
            count * stock.buildingsPerColor * PALACE_COLORS.length
        )
        expect(actions.length).toBeGreaterThan(20)
    })

    it('never overlaps two pieces on a space', () => {
        const { state } = play(count, 4)
        const hydrated = new HydratedMedinaGameState(state)
        const spaces = [
            hydrated.well,
            ...hydrated.buildings.map((piece) => piece.coords),
            ...hydrated.stables.map((piece) => piece.coords),
            ...hydrated.merchants()
        ].map((space) => `${space.x},${space.y}`)
        expect(new Set(spaces).size).toBe(spaces.length)
    })

    it('keeps every wall chain from reaching another tower', () => {
        const { state } = play(count, 5)
        const hydrated = new HydratedMedinaGameState(state)
        for (const side of new Set(hydrated.walls.map((wall) => wall.side))) {
            const onSide = hydrated.walls.filter((wall) => wall.side === side)
            const length =
                side === 'north' || side === 'south'
                    ? hydrated.size().width
                    : hydrated.size().height
            expect(onSide.length).toBeLessThan(length)
        }
    })
})
