import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { leadDefense } from '../model/attackThreat.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type LeadDefense = Type.Static<typeof LeadDefense>
export const LeadDefense = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LeadDefense),
            playerId: Type.String(),
            leaderIds: Type.Array(Type.String(), { maxItems: 2 })
        })
    ])
)

export const LeadDefenseValidator = Compile(LeadDefense)

export function isLeadDefense(action?: GameAction): action is LeadDefense {
    return action?.type === ActionType.LeadDefense
}

export class HydratedLeadDefense
    extends NapoleonsTriumphAction<typeof LeadDefense>
    implements LeadDefense
{
    declare type: ActionType.LeadDefense
    declare playerId: string
    declare leaderIds: string[]

    constructor(data: LeadDefense) {
        super(data, LeadDefenseValidator)
    }

    // Naming is not secret; a block turned face-up is. Once this has shown the attacker a leading
    // unit he could not see, neither it nor his press before it can be taken back.
    protected perform(state: HydratedNapoleonsTriumphGameState) {
        const unseen = this.leaderIds.some((id) => state.findUnit(id)?.shown === undefined)
        leadDefense(state, this.leaderIds)
        if (unseen) {
            this.revealsInfo = true
        }
    }
}
