import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { payment } from '../components/rules.js'
import { ResourceAmounts, subtractResources } from '../components/resources.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { burnsExactly, citiesSupplied, plantsOf } from '../model/fuel.js'

export type PowerCitiesMetadata = Type.Static<typeof PowerCitiesMetadata>
export const PowerCitiesMetadata = Type.Object({
    powered: Type.Integer(),
    earned: Type.Integer()
})

export type PowerCities = Type.Static<typeof PowerCities>
export const PowerCities = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PowerCities),
            playerId: Type.String(),
            plants: Type.Array(Type.Integer()),
            fuel: ResourceAmounts,
            metadata: Type.Optional(PowerCitiesMetadata)
        })
    ])
)

export const PowerCitiesValidator = Compile(PowerCities)

export function isPowerCities(action?: GameAction): action is PowerCities {
    return action?.type === ActionType.PowerCities
}

/** Phase 5 earning (Recharged p. 6): run the chosen plants on exactly their fuel and get paid. */
export class HydratedPowerCities
    extends HydratableAction<typeof PowerCities>
    implements PowerCities
{
    declare type: ActionType.PowerCities
    declare playerId: string
    declare plants: number[]
    declare fuel: ResourceAmounts
    declare metadata?: PowerCitiesMetadata

    constructor(data: PowerCities) {
        super(data, PowerCitiesValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        if (
            !state.canBurn(this.playerId, this.plants, this.fuel) ||
            !burnsExactly(plantsOf(this.plants), this.fuel)
        ) {
            throw Error('Invalid PowerCities action')
        }
        const player = state.getPlayerState(this.playerId)
        const powered = Math.min(
            citiesSupplied(plantsOf(this.plants)),
            state.cityCount(this.playerId)
        )
        const earned = payment(powered)
        player.resources = subtractResources(player.resources, this.fuel)
        player.money += earned
        state.phaseDone.push(this.playerId)
        this.metadata = { powered, earned }
    }
}
