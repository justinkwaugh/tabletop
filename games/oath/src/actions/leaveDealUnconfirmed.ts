import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { OpenDeal } from '../model/question.js'
import { openDealsOf } from '../util/exchange.js'
import { closeOpenDeal, openDealOf } from '../util/deals.js'

/** The deal as it stood when it was closed: its two parties and both promises, public. */
export type LeaveDealUnconfirmedMetadata = Type.Static<typeof LeaveDealUnconfirmedMetadata>
export const LeaveDealUnconfirmedMetadata = Type.Object({
    deal: OpenDeal
})

/**
 * R-7.6.3-H1 — a minor action: either party closes one of their open Tribunal deals as left
 * unconfirmed, on their own turn, asking no one. It closes the deal for both.
 */
export type LeaveDealUnconfirmed = Type.Static<typeof LeaveDealUnconfirmed>
export const LeaveDealUnconfirmed = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LeaveDealUnconfirmed),
            playerId: Type.String(),
            dealId: Type.String(),
            metadata: Type.Optional(LeaveDealUnconfirmedMetadata)
        })
    ])
)

export const LeaveDealUnconfirmedValidator = Compile(LeaveDealUnconfirmed)

export function isLeaveDealUnconfirmed(action?: GameAction): action is LeaveDealUnconfirmed {
    return action?.type === ActionType.LeaveDealUnconfirmed
}

export class HydratedLeaveDealUnconfirmed
    extends HydratableAction<typeof LeaveDealUnconfirmed>
    implements LeaveDealUnconfirmed
{
    declare type: ActionType.LeaveDealUnconfirmed
    declare playerId: string
    declare dealId: string
    declare metadata?: LeaveDealUnconfirmedMetadata

    constructor(data: LeaveDealUnconfirmed) {
        super(data, LeaveDealUnconfirmedValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedLeaveDealUnconfirmed.reasonCannotLeave(
            state,
            this.playerId,
            this.dealId
        )
        if (reason) throw Error(`Cannot leave the deal unconfirmed: ${reason}`)
        const deal = openDealOf(state, this.playerId, this.dealId)
        assertExists(deal, 'the deal is open and the player is party to it')
        closeOpenDeal(state, this.dealId)
        this.metadata = { deal: { ...deal } }
    }

    static reasonCannotLeave(
        state: HydratedOathGameState,
        playerId: string,
        dealId: string
    ): string | undefined {
        return openDealOf(state, playerId, dealId)
            ? undefined
            : 'you have no open deal by that name'
    }

    static canDoLeaveDealUnconfirmed(state: HydratedOathGameState, playerId: string): boolean {
        return openDealsOf(state, playerId).length > 0
    }
}
