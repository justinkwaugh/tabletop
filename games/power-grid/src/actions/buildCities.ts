import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'

export type BuiltCity = Type.Static<typeof BuiltCity>
export const BuiltCity = Type.Object({
    cityId: Type.String(),
    connectionCost: Type.Integer(),
    houseCost: Type.Integer()
})

export type BuildCitiesMetadata = Type.Static<typeof BuildCitiesMetadata>
export const BuildCitiesMetadata = Type.Object({
    built: Type.Array(BuiltCity),
    total: Type.Integer()
})

export type BuildCities = Type.Static<typeof BuildCities>
export const BuildCities = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildCities),
            playerId: Type.String(),
            cityIds: Type.Array(Type.String()),
            metadata: Type.Optional(BuildCitiesMetadata)
        })
    ])
)

export const BuildCitiesValidator = Compile(BuildCities)

export function isBuildCities(action?: GameAction): action is BuildCities {
    return action?.type === ActionType.BuildCities
}

/**
 * A player's whole Phase 4 turn, possibly building nowhere. The cities are connected in the
 * cheapest legal order, each from the network or a city added before it (Recharged p. 5).
 */
export class HydratedBuildCities
    extends HydratableAction<typeof BuildCities>
    implements BuildCities
{
    declare type: ActionType.BuildCities
    declare playerId: string
    declare cityIds: string[]
    declare metadata?: BuildCitiesMetadata

    constructor(data: BuildCities) {
        super(data, BuildCitiesValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const quote = state.buildQuote(this.playerId, this.cityIds)
        if (!quote || !state.canAfford(this.playerId, quote.total)) {
            throw Error('Invalid BuildCities action')
        }
        for (const step of quote.steps) {
            state.cities[step.cityId] = [...state.occupants(step.cityId), this.playerId]
        }
        state.blockForTrust(quote.steps.map((step) => step.cityId))
        state.getPlayerState(this.playerId).money -= quote.total
        state.endTurn(this.playerId)
        this.metadata = {
            built: quote.steps.map(({ cityId, connectionCost, houseCost }) => ({
                cityId,
                connectionCost,
                houseCost
            })),
            total: quote.total
        }
    }
}
