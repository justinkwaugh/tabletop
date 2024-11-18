import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'

export type LaunchMetadata = Static<typeof LaunchMetadata>
export const LaunchMetadata = Type.Object({})

export type Launch = Static<typeof Launch>
export const Launch = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Launch),
        playerId: Type.String(),
        sundiverIds: Type.Array(Type.String()),
        destination: OffsetCoordinates,
        metadata: Type.Optional(LaunchMetadata)
    })
])

export const LaunchValidator = TypeCompiler.Compile(Launch)

export function isLaunch(action?: GameAction): action is Launch {
    return action?.type === ActionType.Launch
}

export class HydratedLaunch extends HydratableAction<typeof Launch> implements Launch {
    declare type: ActionType.Launch
    declare playerId: string
    declare sundiverIds: string[]
    declare destination: OffsetCoordinates
    declare metadata?: LaunchMetadata

    constructor(data: Launch) {
        super(data, LaunchValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
    }
}
