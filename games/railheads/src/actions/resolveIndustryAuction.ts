import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Industry } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { IndustrySale, resolveIndustryAuction } from '../model/industryAuctionRules.js'

export type ResolveIndustryAuctionMetadata = Type.Static<typeof ResolveIndustryAuctionMetadata>
export const ResolveIndustryAuctionMetadata = Type.Object({
    industry: Type.Enum(Industry),
    level: Type.Number(),
    sale: IndustrySale
})

export type ResolveIndustryAuction = Type.Static<typeof ResolveIndustryAuction>
export const ResolveIndustryAuction = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveIndustryAuction),
            metadata: Type.Optional(ResolveIndustryAuctionMetadata)
        })
    ])
)

export const ResolveIndustryAuctionValidator = Compile(ResolveIndustryAuction)

export function isResolveIndustryAuction(action?: GameAction): action is ResolveIndustryAuction {
    return action?.type === ActionType.ResolveIndustryAuction
}

export class HydratedResolveIndustryAuction
    extends HydratableAction<typeof ResolveIndustryAuction>
    implements ResolveIndustryAuction
{
    declare type: ActionType.ResolveIndustryAuction
    declare metadata?: ResolveIndustryAuctionMetadata

    constructor(data: ResolveIndustryAuction) {
        super(data, ResolveIndustryAuctionValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        const auction = state.industryAuction
        assertExists(auction, 'No industry auction to resolve')
        const { industry, minimum: level } = auction
        const sale = resolveIndustryAuction(state)
        this.metadata = { industry, level, sale }
    }
}
