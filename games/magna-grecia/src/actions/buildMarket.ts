import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'
import { marketCost } from '../model/marketRules.js'

export type BuildMarketMetadata = Type.Static<typeof BuildMarketMetadata>
export const BuildMarketMetadata = Type.Object({
    cost: Type.Number()
})

export type BuildMarket = Type.Static<typeof BuildMarket>
export const BuildMarket = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildMarket),
            playerId: Type.String(),
            metadata: Type.Optional(BuildMarketMetadata),
            placeId: Type.String()
        })
    ])
)

export const BuildMarketValidator = Compile(BuildMarket)

export function isBuildMarket(action?: GameAction): action is BuildMarket {
    return action?.type === ActionType.BuildMarket
}

export class HydratedBuildMarket
    extends HydratableAction<typeof BuildMarket>
    implements BuildMarket
{
    declare type: ActionType.BuildMarket
    declare playerId: string
    declare metadata?: BuildMarketMetadata
    declare placeId: string

    constructor(data: BuildMarket) {
        super(data, BuildMarketValidator)
    }

    apply(state: HydratedMagnaGreciaGameState, _context?: MachineContext) {
        const place = state.marketSites(this.playerId).find((site) => site.id === this.placeId)
        assertExists(place, 'Invalid BuildMarket action')
        const cost = marketCost(state.board, this.playerId, place)
        state.getPlayerState(this.playerId).points -= cost
        state.board.addMarket({ playerId: this.playerId, placeId: this.placeId, sold: false })
        this.metadata = { cost }
    }

    static canBuildMarket(state: HydratedMagnaGreciaGameState, playerId: string): boolean {
        return state.marketSites(playerId).length > 0
    }
}
