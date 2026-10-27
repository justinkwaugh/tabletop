import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ResourceAmounts, addResources, subtractResources } from '../components/resources.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'

export type BuyResourcesMetadata = Type.Static<typeof BuyResourcesMetadata>
export const BuyResourcesMetadata = Type.Object({ cost: Type.Integer() })

export type BuyResources = Type.Static<typeof BuyResources>
export const BuyResources = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyResources),
            playerId: Type.String(),
            resources: ResourceAmounts,
            metadata: Type.Optional(BuyResourcesMetadata)
        })
    ])
)

export const BuyResourcesValidator = Compile(BuyResources)

export function isBuyResources(action?: GameAction): action is BuyResources {
    return action?.type === ActionType.BuyResources
}

/** A player's whole purchase for Phase 3, possibly nothing; the cheapest tokens go first. */
export class HydratedBuyResources
    extends HydratableAction<typeof BuyResources>
    implements BuyResources
{
    declare type: ActionType.BuyResources
    declare playerId: string
    declare resources: ResourceAmounts
    declare metadata?: BuyResourcesMetadata

    constructor(data: BuyResources) {
        super(data, BuyResourcesValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        if (!state.canBuyResources(this.playerId, this.resources)) {
            throw Error('Invalid BuyResources action')
        }
        const cost = state.resourceCost(this.resources)
        const player = state.getPlayerState(this.playerId)
        player.money -= cost
        player.resources = addResources(player.resources, this.resources)
        state.resourceMarket = subtractResources(state.resourceMarket, this.resources)
        state.endTurn(this.playerId)
        this.metadata = { cost }
    }
}
