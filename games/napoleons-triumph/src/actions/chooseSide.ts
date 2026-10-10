import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, assert, assertExists } from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { assignSides } from '../model/sides.js'

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

export class HydratedChooseSide extends HydratableAction<typeof ChooseSide> implements ChooseSide {
    declare type: ActionType.ChooseSide
    declare playerId: string
    declare side: Side

    constructor(data: ChooseSide) {
        super(data, ChooseSideValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const auction = state.auction
        assertExists(auction, 'There is no morale auction')
        assert(auction.highBidderId === this.playerId, 'The auction winner chooses the army')
        assignSides(state, this.playerId, this.side, auction.highBid ?? 0)
        state.auction = undefined
    }
}
