import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CompanyId, InvestmentItem } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import {
    InvestmentPurchase,
    claimInvestment,
    claimableItems
} from '../model/industryAuctionRules.js'

export type ClaimInvestmentMetadata = Type.Static<typeof ClaimInvestmentMetadata>
export const ClaimInvestmentMetadata = Type.Object({
    purchase: InvestmentPurchase
})

export type ClaimInvestment = Type.Static<typeof ClaimInvestment>
export const ClaimInvestment = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ClaimInvestment),
            playerId: Type.String(),
            metadata: Type.Optional(ClaimInvestmentMetadata),
            item: Type.Enum(InvestmentItem),
            // A Government Bond's price goes to this company, or else to the State Treasury.
            fundedCompanyId: Type.Optional(Type.Enum(CompanyId))
        })
    ])
)

export const ClaimInvestmentValidator = Compile(ClaimInvestment)

export function isClaimInvestment(action?: GameAction): action is ClaimInvestment {
    return action?.type === ActionType.ClaimInvestment
}

export class HydratedClaimInvestment
    extends HydratableAction<typeof ClaimInvestment>
    implements ClaimInvestment
{
    declare type: ActionType.ClaimInvestment
    declare playerId: string
    declare metadata?: ClaimInvestmentMetadata
    declare item: InvestmentItem
    declare fundedCompanyId?: CompanyId

    constructor(data: ClaimInvestment) {
        super(data, ClaimInvestmentValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        const purchase = claimInvestment(state, this.playerId, this.item, this.fundedCompanyId)
        this.metadata = { purchase }
    }

    static canClaim(state: HydratedRailheadsGameState, playerId: string): boolean {
        return claimableItems(state, playerId).length > 0
    }
}
