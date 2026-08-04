import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { CanalSegment, isSameSegment } from '../model/board.js'
import { isCanalPlaced, isConnectedToSpring } from '../util/irrigation.js'
import { maxSegmentTotal } from '../util/canal.js'

export type OverseerDecision = Type.Static<typeof OverseerDecision>
export const OverseerDecision = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.OverseerDecision),
            segment: CanalSegment,
            // true = accept the proposal at this segment; false = reject all, build here
            accepting: Type.Boolean()
        })
    ])
)

export const OverseerDecisionValidator = Compile(OverseerDecision)

export function isOverseerDecision(action: GameAction): action is OverseerDecision {
    return action.type === ActionType.OverseerDecision
}


export class HydratedOverseerDecision
    extends HydratableAction<typeof OverseerDecision>
    implements OverseerDecision
{
    declare type: ActionType.OverseerDecision
    declare segment: CanalSegment
    declare accepting: boolean

    constructor(data: OverseerDecision) {
        super(data, OverseerDecisionValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        if (!this.playerId) throw new Error('OverseerDecision requires a playerId')
        if (!state.canalOverseerId) throw new Error('No canal overseer')

        if (isCanalPlaced(state.board, this.segment)) {
            throw new Error('Canal segment is already placed')
        }
        if (!isConnectedToSpring(state.board, this.segment)) {
            throw new Error('Canal segment is not connected to the spring network')
        }

        state.board.canals.push(this.segment)

        const overseer = state.getPlayerState(state.canalOverseerId)

        if (this.accepting) {
            // Pay the overseer from every proposer who offered at this segment
            const accepted = state.canalProposals.filter((p) =>
                isSameSegment(p.segment, this.segment)
            )
            for (const proposal of accepted) {
                const proposer = state.getPlayerState(proposal.playerId)
                proposer.pay(proposal.amount)
                overseer.earn(proposal.amount)
            }
        } else {
            // Reject all: overseer pays the bank one more than the best bribe on the table.
            // With no bribes at all that's 1 escudo - it used to be free, which is what left
            // the history with nothing to report for a no-bribe round.
            // Capped at what the overseer actually holds: pay() throws on insufficient
            // funds, and a penniless overseer has no other legal move (there are no bribes
            // to accept either), so charging strictly would deadlock the phase rather than
            // enforce anything. Also see CanalBuildingStateHandler.isValidAction, which
            // only lets an overseer who can't cover the cost through in exactly that case.
            const penalty = maxSegmentTotal(state.canalProposals)
            overseer.pay(Math.min(penalty + 1, overseer.money))
        }
    }
}
