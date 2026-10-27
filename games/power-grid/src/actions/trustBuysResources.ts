import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { PlantKind, plantResources, powerPlant } from '../components/plants.js'
import {
    Resource,
    ResourceAmounts,
    noResources,
    subtractResources
} from '../components/resources.js'
import { TRUST, type HydratedPowerGridGameState } from '../model/gameState.js'

export type TrustBuysResources = Type.Static<typeof TrustBuysResources>
export const TrustBuysResources = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.TrustBuysResources),
            metadata: Type.Optional(Type.Object({ taken: ResourceAmounts }))
        })
    ])
)

export const TrustBuysResourcesValidator = Compile(TrustBuysResources)

export function isTrustBuysResources(action?: GameAction): action is TrustBuysResources {
    return action?.type === ActionType.TrustBuysResources
}

/**
 * Recharged p. 9: the Trust takes, free, the fuel for one run of every plant, as far as the
 * market has it; across all its hybrids it takes coal and oil in turn, coal first.
 */
export class HydratedTrustBuysResources
    extends HydratableAction<typeof TrustBuysResources>
    implements TrustBuysResources
{
    declare type: ActionType.TrustBuysResources
    declare metadata?: { taken: ResourceAmounts }

    constructor(data: TrustBuysResources) {
        super(data, TrustBuysResourcesValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const trust = state.trust
        assertExists(trust, 'The Trust is not in this game')
        const taken = noResources()
        const take = (resource: Resource): boolean => {
            if (state.resourceMarket[resource] - taken[resource] <= 0) {
                return false
            }
            taken[resource] += 1
            return true
        }
        let hybridTokens = 0
        for (const number of trust.plants) {
            const plant = powerPlant(number)
            const fuels = plantResources(plant.kind)
            const hybrid = plant.kind === PlantKind.Hybrid
            for (let token = 0; token < plant.fuel; token++) {
                const [first, second] =
                    hybrid && hybridTokens++ % 2 === 1 ? fuels.toReversed() : fuels
                if (!take(first) && second !== undefined) {
                    take(second)
                }
            }
        }
        state.resourceMarket = subtractResources(state.resourceMarket, taken)
        trust.resources = taken
        state.phaseDone.push(TRUST)
        this.metadata = { taken }
    }
}
