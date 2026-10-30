import {
    ActionSource,
    GameEngine,
    assertExists,
    createAction,
    type Game,
    type HydratedAction,
    type MachineStateHandler
} from '@tabletop/common'
import type * as Type from 'typebox'
import { RevealHand } from '../actions/revealHand.js'
import type { RailroadId } from '../components/railroads.js'
import { Definition } from '../definition/definition.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedPromontoryPointGameState,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import { canonical } from './startGame.js'

// Until the turn's handlers exist, every state lets an action's own guard decide and stays put.
const actionGuardDecides: MachineStateHandler<HydratedAction, HydratedPromontoryPointGameState> = {
    isValidAction: () => true,
    validActionsForPlayer: () => [],
    enter: () => {},
    onAction: (_action, context) => context.gameState.machineState
}

export const actionEngine = new GameEngine({
    ...Definition.runtime,
    stateHandlers: {
        [MachineState.StartingTurn]: actionGuardDecides,
        [MachineState.TradingBeforePlacing]: actionGuardDecides,
        [MachineState.Placing]: actionGuardDecides,
        [MachineState.PayingRepairs]: actionGuardDecides,
        [MachineState.TradingAfterPlacing]: actionGuardDecides,
        [MachineState.EndOfGame]: actionGuardDecides
    }
})

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

// R-2.1: the first seat's turn open and the seat active, as the turn's start leaves it.
export function atTurnStart(state: PromontoryPointGameState): PromontoryPointGameState {
    const hydrated = new HydratedPromontoryPointGameState(structuredClone(state))
    const playerId = hydrated.turnManager.turnOrder[0]
    hydrated.turnManager.startTurn(playerId, hydrated.actionCount)
    hydrated.activePlayerIds = [playerId]
    return canonical(hydrated.dehydrate())
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

export function turnPlayer(state: PromontoryPointProjectedState): string {
    return state.turnManager.turnOrder[0]
}

// R-2.2 step 1: the hand revealed and trading open before the first placement.
export function revealedTurn(
    game: Game,
    state: PromontoryPointGameState
): PromontoryPointGameState {
    const started = atTurnStart(state)
    const { updatedState } = actionEngine.executeCanonicalAction({
        action: action(RevealHand, started, {
            source: ActionSource.System,
            playerId: turnPlayer(started)
        }),
        state: started,
        game
    })
    return edited(canonical(updatedState), (draft) => {
        draft.machineState = MachineState.TradingBeforePlacing
    })
}
