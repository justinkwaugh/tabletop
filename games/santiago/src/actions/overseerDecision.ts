import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { CanalSegment, isSameSegment } from '../model/board.js'
import { isCanalPlaced, isConnectedToSpring } from '../util/irrigation.js'

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

function maxSegmentTotal(proposals: Array<{ segment: CanalSegment; amount: number }>): number {
    const totals = new Map<string, number>()
    for (const p of proposals) {
        const key = `${p.segment.orientation},${p.segment.col},${p.segment.row}`
        totals.set(key, (totals.get(key) ?? 0) + p.amount)
    }
    return totals.size > 0 ? Math.max(...totals.values()) : 0
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
            // Reject all: overseer pays bank (max combined segment offer) + 1
            const penalty = maxSegmentTotal(state.canalProposals)
            if (penalty > 0) overseer.pay(penalty + 1)
        }
    }
}
