import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { advance } from '../model/attackDecisions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type Advance = Type.Static<typeof Advance>
export const Advance = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Advance),
            playerId: Type.String(),
            unitIds: Type.Array(Type.String(), { minItems: 1 }),
            commanderIds: Type.Array(Type.String())
        })
    ])
)

export const AdvanceValidator = Compile(Advance)

export function isAdvance(action?: GameAction): action is Advance {
    return action?.type === ActionType.Advance
}

export class HydratedAdvance extends NapoleonsTriumphAction<typeof Advance> implements Advance {
    declare type: ActionType.Advance
    declare playerId: string
    declare unitIds: string[]
    declare commanderIds: string[]

    constructor(data: Advance) {
        super(data, AdvanceValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        advance(state, this.playerId, this.unitIds, this.commanderIds)
    }
}
