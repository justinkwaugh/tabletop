import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../components/railroads.js'
import { ShareAuctionKind, type HydratedOstbahnGameState } from '../model/gameState.js'
import { ShareSale, openShareAuction, settleShareAuction } from '../model/shareAuction.js'

export type CapitalizeMetadata = Type.Static<typeof CapitalizeMetadata>
export const CapitalizeMetadata = Type.Object({
    withdrawnPlayerIds: Type.Array(Type.String()),
    sale: Type.Optional(ShareSale)
})

export type Capitalize = Type.Static<typeof Capitalize>
export const Capitalize = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Capitalize),
            playerId: Type.String(),
            metadata: Type.Optional(CapitalizeMetadata),
            railroadId: Type.Enum(RailroadId)
        })
    ])
)

export const CapitalizeValidator = Compile(Capitalize)

export function isCapitalize(action?: GameAction): action is Capitalize {
    return action?.type === ActionType.Capitalize
}

export class HydratedCapitalize extends HydratableAction<typeof Capitalize> implements Capitalize {
    declare type: ActionType.Capitalize
    declare playerId: string
    declare metadata?: CapitalizeMetadata
    declare railroadId: RailroadId

    constructor(data: Capitalize) {
        super(data, CapitalizeValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        assert(state.isSlotPlayer(this.playerId), 'It is not your turn')
        assert(
            state.capitalizableRailroads().includes(this.railroadId),
            'That railroad has no share for sale'
        )
        const withdrawnPlayerIds = openShareAuction(
            state,
            ShareAuctionKind.Capitalization,
            this.railroadId,
            this.playerId
        )
        const sale = state.bidding().remainingPlayerIds.length
            ? undefined
            : settleShareAuction(state)
        this.metadata = { withdrawnPlayerIds, ...(sale ? { sale } : {}) }
    }

    static canCapitalize(state: HydratedOstbahnGameState, playerId: string): boolean {
        return state.isSlotPlayer(playerId) && state.capitalizableRailroads().length > 0
    }
}
