import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CompanyId } from '../components/companies.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { ShareSale, openShareAuction, settleShareAuction } from '../model/shareAuctionRules.js'

export type OpenAuctionMetadata = Type.Static<typeof OpenAuctionMetadata>
export const OpenAuctionMetadata = Type.Object({
    withdrawnPlayerIds: Type.Array(Type.String()),
    sale: Type.Optional(ShareSale)
})

export type OpenAuction = Type.Static<typeof OpenAuction>
export const OpenAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.OpenAuction),
            playerId: Type.String(),
            metadata: Type.Optional(OpenAuctionMetadata),
            companyId: Type.Enum(CompanyId),
            amount: Type.Number()
        })
    ])
)

export const OpenAuctionValidator = Compile(OpenAuction)

export function isOpenAuction(action?: GameAction): action is OpenAuction {
    return action?.type === ActionType.OpenAuction
}

export class HydratedOpenAuction
    extends HydratableAction<typeof OpenAuction>
    implements OpenAuction
{
    declare type: ActionType.OpenAuction
    declare playerId: string
    declare metadata?: OpenAuctionMetadata
    declare companyId: CompanyId
    declare amount: number

    constructor(data: OpenAuction) {
        super(data, OpenAuctionValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(
            state.auctionableCompanies().includes(this.companyId),
            'That company has no share left'
        )
        assert(
            Number.isSafeInteger(this.amount) && this.amount >= 0,
            'Bids are whole dollars from $0'
        )
        assert(
            this.amount <= state.getPlayerState(this.playerId).cash,
            'A bid cannot exceed your cash'
        )
        const withdrawnPlayerIds = openShareAuction(
            state,
            this.companyId,
            this.playerId,
            this.amount
        )
        const sale = settleShareAuction(state)
        this.metadata = { withdrawnPlayerIds, ...(sale ? { sale } : {}) }
    }
}
