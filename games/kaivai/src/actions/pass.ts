import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, GameState, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export enum PassReason {
    DoneActions = 'actions',
    DoneBuilding = 'building',
    DoneFishing = 'fishing',
    DoneDelivering = 'delivering',
    DoneMoving = 'moving'
}

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({
    reason: Type.Enum(PassReason)
})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Pass),
            playerId: Type.String(),
            metadata: Type.Optional(PassMetadata)
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

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: GameState) {
        switch (state.machineState) {
            case MachineState.Building:
                this.metadata = { reason: PassReason.DoneBuilding }
                break
            case MachineState.Fishing:
                this.metadata = { reason: PassReason.DoneFishing }
                break
            case MachineState.Delivering:
                this.metadata = { reason: PassReason.DoneDelivering }
                break
            case MachineState.Moving:
                this.metadata = { reason: PassReason.DoneMoving }
                break
            case MachineState.TakingActions:
                this.metadata = { reason: PassReason.DoneActions }
        }
    }
}
