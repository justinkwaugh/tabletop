import { ActionSource, assertExists, createAction, type Game } from '@tabletop/common'
import type * as Type from 'typebox'
import { RevealHand } from '../actions/revealHand.js'
import type { RailroadId } from '../components/railroads.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedPromontoryPointGameState,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import { canonical, engine } from './startGame.js'

export function action<T extends Type.TSchema>(
    schema: T,
    state: PromontoryPointProjectedState,
    fields: Partial<Type.Static<T>>
): Type.Static<T> {
    return createAction(schema, {
        id: `action-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        index: state.actionCount,
        ...fields
    })
}

export function edited(
    state: PromontoryPointGameState,
    edit: (draft: PromontoryPointGameState) => void
): PromontoryPointGameState {
    const draft = structuredClone(state)
    edit(draft)
    return canonical(draft)
}

// R-2.1, R-2.2 step 1: the first seat's turn open, its seat active and its hand still concealed,
// as StartingTurn's entry leaves a turn before RevealHand runs.
export function atTurnStart(state: PromontoryPointGameState): PromontoryPointGameState {
    return edited(state, (draft) => {
        const turn = draft.turn
        assertExists(turn, 'The fixture starts from a turn opened at setup')
        const playerId = turnPlayer(draft)
        const player = playerOf(draft, playerId)
        player.hand = turn.pieces
        player.handCount = turn.pieces.length
        delete draft.turn
        draft.machineState = MachineState.StartingTurn
        draft.activePlayerIds = [playerId]
    })
}

export function playerOf<State extends PromontoryPointProjectedState>(
    state: State,
    playerId: string
): State['players'][number] {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    assertExists(player, `No player ${playerId}`)
    return player
}

export function shareDeckCount(
    state: PromontoryPointProjectedState,
    railroadId: RailroadId
): number {
    return new HydratedPromontoryPointGameState(structuredClone(state)).shareDeckCount(railroadId)
}

// R-2.1: the seat at a position in turn order.
export function seatOf(state: PromontoryPointProjectedState, position: number): string {
    const playerId = state.turnManager.turnOrder[position]
    assertExists(playerId, `No seat at position ${position}`)
    return playerId
}

// R-2.1: the player whose turn the turn manager has open.
export function turnPlayer(state: PromontoryPointProjectedState): string {
    const turn = state.turnManager.series.findLast((candidate) => candidate.end === undefined)
    assertExists(turn, 'A turn is open')
    return turn.playerId
}

// R-2.2 step 1: the hand revealed and trading open before the first placement.
export function revealedTurn(
    game: Game,
    state: PromontoryPointGameState
): PromontoryPointGameState {
    const started = atTurnStart(state)
    const { updatedState } = engine.executeCanonicalAction({
        action: action(RevealHand, started, {
            source: ActionSource.System,
            playerId: turnPlayer(started)
        }),
        state: started,
        game
    })
    return canonical(updatedState)
}

// The engine's refusal of an action type the machine state's handler does not take.
export function refusedIn(machineState: MachineState): string {
    return `is not valid in state ${machineState}`
}
