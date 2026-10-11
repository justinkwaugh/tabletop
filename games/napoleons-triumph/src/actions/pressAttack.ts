import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { revealDefenseLeaders } from '../model/attackThreat.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type PressAttack = Type.Static<typeof PressAttack>
export const PressAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PressAttack),
            playerId: Type.String()
        })
    ])
)

export const PressAttackValidator = Compile(PressAttack)

export function isPressAttack(action?: GameAction): action is PressAttack {
    return action?.type === ActionType.PressAttack
}

export class HydratedPressAttack
    extends NapoleonsTriumphAction<typeof PressAttack>
    implements PressAttack
{
    declare type: ActionType.PressAttack
    declare playerId: string

    constructor(data: PressAttack) {
        super(data, PressAttackValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        revealDefenseLeaders(state)
    }
}
