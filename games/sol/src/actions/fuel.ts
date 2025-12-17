import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type FuelMetadata = Static<typeof FuelMetadata>
export const FuelMetadata = Type.Object({})

export type Fuel = Static<typeof Fuel>
export const Fuel = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Fuel),
            playerId: Type.String(),
            metadata: Type.Optional(FuelMetadata)
        })
    ])
)

export const FuelValidator = Compile(Fuel)

export function isFuel(action?: GameAction): action is Fuel {
    return action?.type === ActionType.Fuel
}

export class HydratedFuel extends HydratableAction<typeof Fuel> implements Fuel {
    declare type: ActionType.Fuel
    declare playerId: string
    declare metadata?: FuelMetadata
    constructor(data: Fuel) {
        super(data, FuelValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedFuel.canFuel(state, this.playerId)) {
            throw Error('Invalid fuel')
        }

        const playerState = state.getPlayerState(this.playerId)
        playerState.movementPoints += 3
        state.getEffectTracking().fuelRemaining -= 1

        if (state.getEffectTracking().fuelRemaining === 0) {
            state.activeEffect = undefined
        }
    }

    static canFuel(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return state.getEffectTracking().fuelRemaining > 0 && playerState.energyCubes > 0
    }
}
