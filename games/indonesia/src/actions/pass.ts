import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceCity } from './placeCity.js'

export enum PassReason {
    CannotPlaceCity = 'CannotPlaceCity'
}

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Pass), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PassMetadata), // Always optional, because it is an output
            reason: Type.Enum(PassReason)
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
    declare reason: PassReason

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidPass(state)) {
            throw Error('Invalid Pass action')
        }

        this.metadata = {}
    }

    isValidPass(state: HydratedIndonesiaGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canPass(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (state.machineState === MachineState.NewEra) {
            return !HydratedPlaceCity.canPlaceCity(state, playerId)
        }
        return false
    }
}
