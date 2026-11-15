import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { ShareSale, settleShareAuction } from '../model/shareAuction.js'

export type AwardShareMetadata = Type.Static<typeof AwardShareMetadata>
export const AwardShareMetadata = Type.Object({
    sale: ShareSale
})

export type AwardShare = Type.Static<typeof AwardShare>
export const AwardShare = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.AwardShare),
            metadata: Type.Optional(AwardShareMetadata)
        })
    ])
)

export const AwardShareValidator = Compile(AwardShare)

export function isAwardShare(action?: GameAction): action is AwardShare {
    return action?.type === ActionType.AwardShare
}

export class HydratedAwardShare extends HydratableAction<typeof AwardShare> implements AwardShare {
    declare type: ActionType.AwardShare
    declare metadata?: AwardShareMetadata

    constructor(data: AwardShare) {
        super(data, AwardShareValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        const sale = settleShareAuction(state)
        assertExists(sale, 'A share nobody can bid on goes to the player who offered it')
        this.metadata = { sale }
    }
}
