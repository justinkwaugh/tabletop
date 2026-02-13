import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { WorkerActionType } from '../definition/workerActions.js'

export type ChooseWorkerActionMetadata = Type.Static<typeof ChooseWorkerActionMetadata>
export const ChooseWorkerActionMetadata = Type.Object({})

export type ChooseWorkerAction = Type.Static<typeof ChooseWorkerAction>
export const ChooseWorkerAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.ChooseWorkerAction), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(ChooseWorkerActionMetadata), // Always optional, because it is an output
            actionType: Type.Enum(WorkerActionType) // The type of worker action being chosen
        })
    ])
)

export const ChooseWorkerActionValidator = Compile(ChooseWorkerAction)

export function isChooseWorkerAction(action?: GameAction): action is ChooseWorkerAction {
    return action?.type === ActionType.ChooseWorkerAction
}

export class HydratedChooseWorkerAction
    extends HydratableAction<typeof ChooseWorkerAction>
    implements ChooseWorkerAction
{
    declare type: ActionType.ChooseWorkerAction
    declare playerId: string
    declare metadata?: ChooseWorkerActionMetadata
    declare actionType: WorkerActionType

    constructor(data: ChooseWorkerAction) {
        super(data, ChooseWorkerActionValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidChooseWorkerAction(state)) {
            throw Error('Invalid ChooseWorkerAction action')
        }

        switch (this.actionType) {
            case WorkerActionType.Expansion:
                state.lineExpansionAction.push(this.playerId)
                break
            case WorkerActionType.Buildings:
                state.buildingAction.push(this.playerId)
                break
            case WorkerActionType.Passengers:
                state.passengersAction.push(this.playerId)
                break
            case WorkerActionType.Buses:
                state.busAction = this.playerId
                break
            case WorkerActionType.Clock:
                state.clockAction = this.playerId
                break
            case WorkerActionType.Vroom:
                state.vroomAction.push(this.playerId)
                break
            case WorkerActionType.StartingPlayer:
                state.startingPlayerAction = this.playerId
                break
        }

        const playerState = state.getPlayerState(this.playerId)
        playerState.actions -= 1
        playerState.numActionsChosen += 1

        this.metadata = {}
    }

    isValidChooseWorkerAction(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        if (playerState.actions <= 0) {
            return false
        }

        switch (this.actionType) {
            case WorkerActionType.Expansion:
                return state.lineExpansionAction.length < 6
            case WorkerActionType.Buildings:
                return state.buildingAction.length < 6
            case WorkerActionType.Passengers:
                return state.passengersAction.length < 6
            case WorkerActionType.Buses:
                return state.busAction === undefined
            case WorkerActionType.Clock:
                return state.clockAction === undefined
            case WorkerActionType.Vroom:
                return state.vroomAction.length < 6
            case WorkerActionType.StartingPlayer:
                return state.startingPlayerAction === undefined
        }
    }

    static canChooseWorkerAction(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return playerState.actions > 0
    }
}
