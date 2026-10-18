import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Industry } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { openIndustryAuction } from '../model/industryAuctionRules.js'

export type InvestInIndustryMetadata = Type.Static<typeof InvestInIndustryMetadata>
export const InvestInIndustryMetadata = Type.Object({
    level: Type.Number(),
    bidderIds: Type.Array(Type.String())
})

export type InvestInIndustry = Type.Static<typeof InvestInIndustry>
export const InvestInIndustry = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.InvestInIndustry),
            playerId: Type.String(),
            metadata: Type.Optional(InvestInIndustryMetadata),
            industry: Type.Enum(Industry)
        })
    ])
)

export const InvestInIndustryValidator = Compile(InvestInIndustry)

export function isInvestInIndustry(action?: GameAction): action is InvestInIndustry {
    return action?.type === ActionType.InvestInIndustry
}

export class HydratedInvestInIndustry
    extends HydratableAction<typeof InvestInIndustry>
    implements InvestInIndustry
{
    declare type: ActionType.InvestInIndustry
    declare playerId: string
    declare metadata?: InvestInIndustryMetadata
    declare industry: Industry

    constructor(data: InvestInIndustry) {
        super(data, InvestInIndustryValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        assert(
            state.investableIndustries(this.playerId).includes(this.industry),
            'That industry cannot be invested in'
        )
        openIndustryAuction(state, this.playerId, this.industry)
        this.metadata = {
            level: state.industry(this.industry).level,
            bidderIds: [...(state.industryAuction?.bidders ?? [])]
        }
    }

    static canInvest(state: HydratedRailheadsGameState, playerId: string): boolean {
        return state.turnPlayerId() === playerId && state.investableIndustries(playerId).length > 0
    }
}
