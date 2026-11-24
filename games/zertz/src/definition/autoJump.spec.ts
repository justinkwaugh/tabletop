import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    replaceSupersededAction,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { ZertzSetup } from './config.js'
import { ZertzApiActions } from './apiActions.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import type { ZertzGameState } from '../model/gameState.js'
import { MarbleColor } from '../model/marbles.js'
import type { Ring } from '../model/board.js'
import type { PlaceMarble } from '../actions/placeMarble.js'
import type { Capture } from '../actions/capture.js'
import type { SetAutoJump } from '../actions/setAutoJump.js'
import { actionBase, createGame, engine, type ZertzGame } from './tests/playthrough.js'

function game(autoJump?: boolean): ZertzGame {
    const created = createGame(ZertzSetup.Standard)
    return autoJump === undefined
        ? created
        : { ...created, config: { ...created.config, autoJump } }
}

function start(zertz: ZertzGame, rings: Ring[]): ZertzGameState {
    const state = engine.startGame(zertz, {
        startingPositions: { playerIds: ['p0', 'p1'] }
    }).initialState
    return { ...state, board: { rings } }
}

function line(length: number, marbles: Record<number, MarbleColor> = {}): Ring[] {
    return Array.from({ length }, (_, q) => {
        const marble = marbles[q]
        return marble === undefined ? { coords: { q, r: 0 } } : { coords: { q, r: 0 }, marble }
    })
}

function run(zertz: ZertzGame, state: ZertzGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game: zertz, state, action })
}

function placing(
    zertz: ZertzGame,
    coords: AxialCoordinates,
    remove: AxialCoordinates
): PlaceMarble {
    return {
        ...actionBase(zertz, 'p0'),
        type: ActionType.PlaceMarble,
        color: MarbleColor.White,
        coords,
        remove
    }
}

function capturing(
    zertz: ZertzGame,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates
): Capture {
    return { ...actionBase(zertz, playerId), type: ActionType.Capture, from, to }
}

function declaring(
    zertz: ZertzGame,
    playerId: string,
    on: boolean,
    supersedesActionId?: string
): SetAutoJump {
    return {
        ...actionBase(zertz, playerId),
        type: ActionType.SetAutoJump,
        outOfTurn: true,
        supersedable: true,
        on,
        ...(supersedesActionId === undefined ? {} : { supersedesActionId })
    }
}

// p0's white marble at (1,0) leaves p1 one jump, (1,0) over (2,0) to (3,0), and from there one
// more, over (4,0) to (5,0). The spare ring at (0,1) is the one removed.
const CHAIN_FOR_P1 = [
    ...line(6, { 0: MarbleColor.Black, 2: MarbleColor.Grey, 4: MarbleColor.Black }),
    { coords: { q: 0, r: 1 } }
]
const SPARE = { q: 0, r: 1 }

// p0 may jump (0,0) over (1,0) or (1,0) over (1,1); the first goes on over (3,0) alone.
const TWO_CHOICES = [
    ...line(5, { 0: MarbleColor.White, 1: MarbleColor.Grey, 3: MarbleColor.Black }),
    { coords: { q: 1, r: 1 }, marble: MarbleColor.Grey },
    { coords: { q: 1, r: 2 } }
]

const ONE_JUMP = line(4, { 0: MarbleColor.White, 1: MarbleColor.Black })

function moves(actions: GameAction[]) {
    return actions.map(({ type, source, playerId }) => ({ type, source, playerId }))
}

describe('auto-jump for both players', () => {
    it('jumps a chain of single choices for the player to move at once', () => {
        const zertz = game(true)
        const state = start(zertz, CHAIN_FOR_P1)
        expect(state.autoJumpForAll).toBe(true)

        const result = run(zertz, state, placing(zertz, { q: 1, r: 0 }, SPARE))
        expect(moves(result.processedActions)).toEqual([
            { type: ActionType.PlaceMarble, source: ActionSource.User, playerId: 'p0' },
            { type: ActionType.Capture, source: ActionSource.System, playerId: 'p1' },
            { type: ActionType.Capture, source: ActionSource.System, playerId: 'p1' }
        ])
        const after = result.updatedState
        expect(after.machineState).toBe(MachineState.TakingTurn)
        expect(after.activePlayerIds).toEqual(['p0'])
        expect(after.players[1].captured).toEqual({
            [MarbleColor.White]: 0,
            [MarbleColor.Grey]: 1,
            [MarbleColor.Black]: 1
        })
    })

    it('leaves a choice of jumps to the player, then makes a single continuation', () => {
        const zertz = game(true)
        const state = start(zertz, TWO_CHOICES)
        const result = run(zertz, state, capturing(zertz, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 }))
        expect(moves(result.processedActions)).toEqual([
            { type: ActionType.Capture, source: ActionSource.User, playerId: 'p0' },
            { type: ActionType.Capture, source: ActionSource.System, playerId: 'p0' }
        ])
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])
    })

    it('offers no declaration and refuses one', () => {
        const zertz = game(true)
        const state = start(zertz, ONE_JUMP)
        expect(engine.getValidActionTypesForPlayer(zertz, state, 'p0')).toEqual([
            ActionType.Capture
        ])
        expect(engine.getValidActionTypesForPlayer(zertz, state, 'p1')).toEqual([])
        expect(() => run(zertz, state, declaring(zertz, 'p1', true))).toThrow()
    })
})

describe('auto-jump by player', () => {
    it('is off unless asked for, and an older game without the option plays as before', () => {
        for (const zertz of [game(), game(false)]) {
            const state = start(zertz, CHAIN_FOR_P1)
            expect(state.autoJumpForAll).toBeUndefined()
            expect(state.players.map((player) => player.autoJump)).toEqual([undefined, undefined])
            const result = run(zertz, state, placing(zertz, { q: 1, r: 0 }, SPARE))
            expect(result.processedActions).toHaveLength(1)
            expect(result.updatedState.activePlayerIds).toEqual(['p1'])
        }
    })

    it('may be declared by the player who is not to move, and jumps only for them', () => {
        const zertz = game()
        const state = start(zertz, CHAIN_FOR_P1)
        expect(engine.getValidActionTypesForPlayer(zertz, state, 'p0')).toEqual([
            ActionType.PlaceMarble,
            ActionType.SetAutoJump
        ])
        expect(engine.getValidActionTypesForPlayer(zertz, state, 'p1')).toEqual([
            ActionType.SetAutoJump
        ])

        const declared = run(zertz, state, declaring(zertz, 'p1', true))
        expect(declared.processedActions).toHaveLength(1)
        expect(declared.updatedState.players[1].autoJump).toBe(true)
        expect(declared.updatedState.activePlayerIds).toEqual(['p0'])

        const result = run(zertz, declared.updatedState, placing(zertz, { q: 1, r: 0 }, SPARE))
        expect(moves(result.processedActions).slice(1)).toEqual([
            { type: ActionType.Capture, source: ActionSource.System, playerId: 'p1' },
            { type: ActionType.Capture, source: ActionSource.System, playerId: 'p1' }
        ])
    })

    it('does not jump for the player who has it off', () => {
        const zertz = game()
        const declared = run(zertz, start(zertz, CHAIN_FOR_P1), declaring(zertz, 'p0', true))
        const result = run(zertz, declared.updatedState, placing(zertz, { q: 1, r: 0 }, SPARE))
        expect(result.processedActions).toHaveLength(1)
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])
    })

    it('turned on with one jump open to the player to move, makes it at once', () => {
        const zertz = game()
        const result = run(zertz, start(zertz, ONE_JUMP), declaring(zertz, 'p0', true))
        expect(moves(result.processedActions)).toEqual([
            { type: ActionType.SetAutoJump, source: ActionSource.User, playerId: 'p0' },
            { type: ActionType.Capture, source: ActionSource.System, playerId: 'p0' }
        ])
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])
    })

    it('turned on with a choice open, waits for the pick, then continues on its own', () => {
        const zertz = game()
        const declared = run(zertz, start(zertz, TWO_CHOICES), declaring(zertz, 'p0', true))
        expect(declared.processedActions).toHaveLength(1)
        const result = run(
            zertz,
            declared.updatedState,
            capturing(zertz, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        )
        expect(result.processedActions).toHaveLength(2)
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])
    })

    it('may be declared by either player mid-chain', () => {
        const zertz = game()
        const chained = run(
            zertz,
            start(zertz, TWO_CHOICES),
            capturing(zertz, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        ).updatedState
        expect(chained.machineState).toBe(MachineState.ContinuingCapture)
        expect(engine.getValidActionTypesForPlayer(zertz, chained, 'p1')).toEqual([
            ActionType.SetAutoJump
        ])
        const result = run(zertz, chained, declaring(zertz, 'p0', true))
        expect(result.processedActions).toHaveLength(2)
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])

        const waiting = run(zertz, chained, declaring(zertz, 'p1', true))
        expect(waiting.processedActions).toHaveLength(1)
        expect(waiting.updatedState.machineState).toBe(MachineState.ContinuingCapture)
    })

    it('refuses a declaration that changes nothing, unless it replaces one', () => {
        const zertz = game()
        const state = start(zertz, ONE_JUMP)
        expect(() => run(zertz, state, declaring(zertz, 'p1', false))).toThrow()
        const on = run(zertz, state, declaring(zertz, 'p1', true)).updatedState
        expect(() => run(zertz, on, declaring(zertz, 'p1', true))).toThrow()
        const off = run(zertz, on, declaring(zertz, 'p1', false)).updatedState
        expect(off.players[1].autoJump).toBeUndefined()
    })
})

describe('auto-jump declarations in history', () => {
    function history(zertz: ZertzGame, state: ZertzGameState, ...actions: GameAction[]) {
        const processed: GameAction[] = []
        for (const action of actions) {
            const result = run(zertz, state, action)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
        return { state, processed }
    }

    function replacing(
        zertz: ZertzGame,
        state: ZertzGameState,
        window: GameAction[],
        replacement: GameAction
    ) {
        return replaceSupersededAction({
            engine,
            apiActions: ZertzApiActions,
            game: zertz,
            state,
            window,
            replacement
        })
    }

    it('replaces a standing declaration nothing acted on', () => {
        const zertz = game()
        const first = declaring(zertz, 'p1', true)
        const { state, processed } = history(
            zertz,
            start(zertz, line(6)),
            first,
            placing(zertz, { q: 1, r: 0 }, { q: 5, r: 0 })
        )
        const outcome = replacing(zertz, state, processed, declaring(zertz, 'p1', false, first.id))
        expect(outcome.kind).toBe('replace')
    })

    it('keeps a declaration that has made a jump', () => {
        const zertz = game()
        const first = declaring(zertz, 'p1', true)
        const { state, processed } = history(
            zertz,
            start(zertz, CHAIN_FOR_P1),
            first,
            placing(zertz, { q: 1, r: 0 }, SPARE)
        )
        const outcome = replacing(zertz, state, processed, declaring(zertz, 'p1', false, first.id))
        expect(outcome.kind).toBe('invalid')
    })

    it('is not re-applied after Undo where it would jump at once', () => {
        const zertz = game()
        const state = start(zertz, ONE_JUMP)
        const own = declaring(zertz, 'p0', true)
        expect(engine.reapplyDeclaration({ game: zertz, state, action: own })).toBeUndefined()
        const other = declaring(zertz, 'p1', true)
        expect(engine.reapplyDeclaration({ game: zertz, state, action: other })).toBeDefined()
    })
})
