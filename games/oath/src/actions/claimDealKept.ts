import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PowerQuestionKind } from '../model/question.js'
import { TRIBUNAL_ID } from '../data/cardPowers.js'
import { askQuestion } from '../util/questions.js'
import { openDealsOf } from '../util/exchange.js'
import { claimedThisTurn, openDealOf, otherPartyOf, turnOfTheGame } from '../util/deals.js'

export type ClaimDealKeptMetadata = Type.Static<typeof ClaimDealKeptMetadata>
export const ClaimDealKeptMetadata = Type.Object({
    /** The other party, asked to confirm. */
    askedPlayerId: Type.String()
})

/**
 * R-7.6.3-H1 — a minor action: a party to an open Tribunal deal says it was kept and asks the other
 * party to confirm. One claim per deal per turn of the game.
 */
export type ClaimDealKept = Type.Static<typeof ClaimDealKept>
export const ClaimDealKept = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ClaimDealKept),
            playerId: Type.String(),
            dealId: Type.String(),
            metadata: Type.Optional(ClaimDealKeptMetadata)
        })
    ])
)

export const ClaimDealKeptValidator = Compile(ClaimDealKept)

export function isClaimDealKept(action?: GameAction): action is ClaimDealKept {
    return action?.type === ActionType.ClaimDealKept
}

export class HydratedClaimDealKept
    extends HydratableAction<typeof ClaimDealKept>
    implements ClaimDealKept
{
    declare type: ActionType.ClaimDealKept
    declare playerId: string
    declare dealId: string
    declare metadata?: ClaimDealKeptMetadata

    constructor(data: ClaimDealKept) {
        super(data, ClaimDealKeptValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedClaimDealKept.reasonCannotClaim(state, this.playerId, this.dealId)
        if (reason) throw Error(`Cannot claim the deal kept: ${reason}`)
        const deal = openDealOf(state, this.playerId, this.dealId)
        assertExists(deal, 'the claimed deal is open and the player is party to it')
        const askedPlayerId = otherPartyOf(deal, this.playerId)
        const turn = turnOfTheGame(state)
        assertExists(askedPlayerId, 'a deal has another party')
        assertExists(turn, 'a deal is claimed in a turn of the game')
        deal.lastClaimedTurn = turn
        const resolved = askQuestion(state, this.playerId, {
            kind: PowerQuestionKind.DealKept,
            cardId: TRIBUNAL_ID,
            askedPlayerId,
            claimantPlayerId: this.playerId,
            dealId: this.dealId
        })
        assert(resolved === undefined, 'a deal just found open is always asked about')
        this.metadata = { askedPlayerId }
    }

    static reasonCannotClaim(
        state: HydratedOathGameState,
        playerId: string,
        dealId: string
    ): string | undefined {
        const deal = openDealOf(state, playerId, dealId)
        if (!deal) return 'you have no open deal by that name'
        if (claimedThisTurn(state, deal)) return 'this deal was already claimed kept this turn'
        return undefined
    }

    static canDoClaimDealKept(state: HydratedOathGameState, playerId: string): boolean {
        return openDealsOf(state, playerId).some(
            (deal) =>
                HydratedClaimDealKept.reasonCannotClaim(state, playerId, deal.id) === undefined
        )
    }
}
