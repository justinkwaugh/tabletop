import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { STARTING_MORALE, Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { legal } from '../model/legality.js'
import { assignSides, sideChoice } from '../model/sides.js'

export type ChooseSide = Type.Static<typeof ChooseSide>
export const ChooseSide = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseSide),
            playerId: Type.String(),
            side: Type.Enum(Side)
        })
    ])
)

export const ChooseSideValidator = Compile(ChooseSide)

export function isChooseSide(action?: GameAction): action is ChooseSide {
    return action?.type === ActionType.ChooseSide
}

export class HydratedChooseSide
    extends NapoleonsTriumphAction<typeof ChooseSide>
    implements ChooseSide
{
    declare type: ActionType.ChooseSide
    declare playerId: string
    declare side: Side

    constructor(data: ChooseSide) {
        super(data, ChooseSideValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        const { chooserId, handicap } = sideChoice(state)
        legal(chooserId === this.playerId, 'Another player chooses the army')
        legal(STARTING_MORALE[this.side] > handicap, 'That bid would leave the army with no morale')
        assignSides(state, this.playerId, this.side, handicap)
        state.auction = undefined
        // Each player now sees an army dealt from the same stream whichever side was chosen.
        this.revealsInfo = true
    }
}
