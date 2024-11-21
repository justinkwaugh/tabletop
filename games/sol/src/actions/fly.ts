import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'

export type FlyMetadata = Static<typeof FlyMetadata>
export const FlyMetadata = Type.Object({})

export type Fly = Static<typeof Fly>
export const Fly = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Fly),
        playerId: Type.String(),
        pieceIds: Type.Array(Type.String()), // Array due to Cluster Effect, not sundiver specific due to Juggernaut Effect
        gates: Type.Array(SolarGate),
        start: OffsetCoordinates,
        destination: OffsetCoordinates,
        metadata: Type.Optional(FlyMetadata)
    })
])

export const FlyValidator = TypeCompiler.Compile(Fly)

export function isFly(action?: GameAction): action is Fly {
    return action?.type === ActionType.Fly
}

export class HydratedFly extends HydratableAction<typeof Fly> implements Fly {
    declare type: ActionType.Fly
    declare playerId: string
    declare pieceIds: string[]
    declare gates: SolarGate[]
    declare start: OffsetCoordinates
    declare destination: OffsetCoordinates
    declare metadata?: FlyMetadata

    constructor(data: Fly) {
        super(data, FlyValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
    }
}
