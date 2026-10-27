import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    ResourceAmounts,
    coversResources,
    subtractResources,
    totalResources
} from '../components/resources.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { canStore, overflow, plantsOf } from '../model/fuel.js'

export type ScrapPlant = Type.Static<typeof ScrapPlant>
export const ScrapPlant = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ScrapPlant),
            playerId: Type.String(),
            plant: Type.Integer(),
            returned: ResourceAmounts
        })
    ])
)

export const ScrapPlantValidator = Compile(ScrapPlant)

export function isScrapPlant(action?: GameAction): action is ScrapPlant {
    return action?.type === ActionType.ScrapPlant
}

/**
 * Recharged p. 5: a fourth plant forces another out of the game. Its resources move to the
 * remaining plants where they fit; the rest go back to the supply.
 */
export class HydratedScrapPlant extends HydratableAction<typeof ScrapPlant> implements ScrapPlant {
    declare type: ActionType.ScrapPlant
    declare playerId: string
    declare plant: number
    declare returned: ResourceAmounts

    constructor(data: ScrapPlant) {
        super(data, ScrapPlantValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        if (!HydratedScrapPlant.isValidScrap(state, this.playerId, this.plant, this.returned)) {
            throw Error('Invalid ScrapPlant action')
        }
        const player = state.getPlayerState(this.playerId)
        player.plants = player.plants.filter((plant) => plant !== this.plant)
        state.retirePlant(this.plant)
        player.resources = subtractResources(player.resources, this.returned)
        state.scrapping = undefined
    }

    static remainingPlants(state: HydratedPowerGridGameState, playerId: string, plant: number) {
        return plantsOf(state.getPlayerState(playerId).plants.filter((owned) => owned !== plant))
    }

    static scrappablePlants(state: HydratedPowerGridGameState, playerId: string): number[] {
        const scrapping = state.scrapping
        if (scrapping?.playerId !== playerId) {
            return []
        }
        return state
            .getPlayerState(playerId)
            .plants.filter((plant) => plant !== scrapping.boughtPlant)
    }

    static tokensLost(state: HydratedPowerGridGameState, playerId: string, plant: number): number {
        return overflow(
            HydratedScrapPlant.remainingPlants(state, playerId, plant),
            state.getPlayerState(playerId).resources
        )
    }

    static isValidScrap(
        state: HydratedPowerGridGameState,
        playerId: string,
        plant: number,
        returned: ResourceAmounts
    ): boolean {
        if (!HydratedScrapPlant.scrappablePlants(state, playerId).includes(plant)) {
            return false
        }
        const held = state.getPlayerState(playerId).resources
        const remaining = HydratedScrapPlant.remainingPlants(state, playerId, plant)
        return (
            coversResources(held, returned) &&
            canStore(remaining, subtractResources(held, returned)) &&
            totalResources(returned) === overflow(remaining, held)
        )
    }
}
