import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type GrowCityMetadata = Type.Static<typeof GrowCityMetadata>
export const GrowCityMetadata = Type.Object({
    oldSize: Type.Number(),
    newSize: Type.Number()
})

export type GrowCity = Type.Static<typeof GrowCity>
export const GrowCity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.GrowCity),
            metadata: Type.Optional(GrowCityMetadata),
            cityId: Type.String()
        })
    ])
)

export const GrowCityValidator = Compile(GrowCity)

export function isGrowCity(action?: GameAction): action is GrowCity {
    return action?.type === ActionType.GrowCity
}

export class HydratedGrowCity extends HydratableAction<typeof GrowCity> implements GrowCity {
    declare type: ActionType.GrowCity
    declare playerId?: string
    declare metadata?: GrowCityMetadata
    declare cityId: string

    constructor(data: GrowCity) {
        super(data, GrowCityValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidGrowCity(state)) {
            throw Error('Invalid GrowCity action')
        }

        this.metadata = state.growCity(this.cityId)
    }

    isValidGrowCity(state: HydratedIndonesiaGameState): boolean {
        return HydratedGrowCity.canGrowCity(state, this.playerId, this.cityId)
    }

    static canGrowCity(
        state: HydratedIndonesiaGameState,
        playerId?: string,
        cityId?: string
    ): boolean {
        if (state.machineState !== MachineState.CityGrowth) {
            return false
        }

        const growthDecisionPlayerId = state.cityGrowthDecisionPlayerId()
        if (!growthDecisionPlayerId) {
            return false
        }
        if (playerId !== undefined && growthDecisionPlayerId !== playerId) {
            return false
        }

        if (cityId !== undefined) {
            return state.cityGrowthEligibleCityIds().includes(cityId)
        }

        return state.canAnyCityGrow()
    }

    static *validCityAreaIds(
        state: HydratedIndonesiaGameState,
        playerId: string
    ): Generator<string, void, undefined> {
        if (!HydratedGrowCity.canGrowCity(state, playerId)) {
            return
        }

        for (const city of state.cityGrowthEligibleCities()) {
            yield city.area
        }
    }
}
