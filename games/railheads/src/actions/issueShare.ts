import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CompanyId } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { ShareSale, openIssueAuction, settleShareAuction } from '../model/shareAuctionRules.js'

export type IssueShareMetadata = Type.Static<typeof IssueShareMetadata>
export const IssueShareMetadata = Type.Object({
    minimum: Type.Number(),
    withdrawnPlayerIds: Type.Array(Type.String()),
    sale: Type.Optional(ShareSale)
})

export type IssueShare = Type.Static<typeof IssueShare>
export const IssueShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.IssueShare),
            playerId: Type.String(),
            metadata: Type.Optional(IssueShareMetadata),
            companyId: Type.Enum(CompanyId),
            amount: Type.Number()
        })
    ])
)

export const IssueShareValidator = Compile(IssueShare)

export function isIssueShare(action?: GameAction): action is IssueShare {
    return action?.type === ActionType.IssueShare
}

export class HydratedIssueShare extends HydratableAction<typeof IssueShare> implements IssueShare {
    declare type: ActionType.IssueShare
    declare playerId: string
    declare metadata?: IssueShareMetadata
    declare companyId: CompanyId
    declare amount: number

    constructor(data: IssueShare) {
        super(data, IssueShareValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        assert(
            state.issuableCompanies(this.playerId).includes(this.companyId),
            'That share cannot be issued'
        )
        const minimum = state.minimumBid(this.companyId)
        assert(
            Number.isSafeInteger(this.amount) &&
                this.amount >= minimum &&
                this.amount <= state.getPlayerState(this.playerId).cash,
            'The opening bid must be at least the minimum and within your cash'
        )
        const withdrawnPlayerIds = openIssueAuction(
            state,
            this.companyId,
            this.playerId,
            this.amount
        )
        const sale = settleShareAuction(state)
        this.metadata = { minimum, withdrawnPlayerIds, ...(sale ? { sale } : {}) }
    }

    static canIssue(state: HydratedRailheadsGameState, playerId: string): boolean {
        return state.turnPlayerId() === playerId && state.issuableCompanies(playerId).length > 0
    }
}
