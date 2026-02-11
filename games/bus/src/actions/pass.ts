import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export enum PassReason {
    DoneActions = 'DoneActions',
    CannotExpandLine = 'CannotExpandLine',
    CannotAddBus = 'CannotAddBus',
    CannotAddPassenger = 'CannotAddPassenger',
    CannotAddBuildings = 'CannotAddBuildings',
    DeclinedClock = 'DeclinedClock',
    CannotVroom = 'CannotVroom'
}

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({
    reason: Type.Optional(Type.Enum(PassReason))
})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Pass), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PassMetadata), // Always optional, because it is an output
            reason: Type.Optional(Type.Enum(PassReason))
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare playerId: string
    declare metadata?: PassMetadata
    declare reason?: PassReason

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidPass(state)) {
            throw Error('Invalid Pass action')
        }
        const playerState = state.getPlayerState(this.playerId)
        state.passedPlayers.push(this.playerId)
        playerState.numActionsChosen = 0

        this.metadata = {
            reason: this.reason
        }
    }

    isValidPass(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        if (state.machineState === MachineState.ChoosingActions) {
            return playerState.numActionsChosen >= 2 && !state.passedPlayers.includes(this.playerId)
        }
        return true
    }

    static canPass(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return playerState.numActionsChosen >= 2 && !state.passedPlayers.includes(playerId)
    }
}
