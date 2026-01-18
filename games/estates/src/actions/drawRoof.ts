import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { Roof } from '../components/roof.js'

export type DrawRoof = Type.Static<typeof DrawRoof>
export const DrawRoof = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.DrawRoof),
            visibleIndex: Type.Number(),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(
                Type.Object({
                    chosenRoof: Roof
                })
            )
        })
    ])
)

export const DrawRoofValidator = Compile(DrawRoof)

export function isDrawRoof(action: GameAction): action is DrawRoof {
    return action.type === ActionType.DrawRoof
}

export class HydratedDrawRoof extends HydratableAction<typeof DrawRoof> implements DrawRoof {
    declare type: ActionType.DrawRoof
    declare visibleIndex: number
    declare revealsInfo: true
    declare metadata: { chosenRoof: Roof }

    constructor(data: DrawRoof) {
        super(data, DrawRoofValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const drawnRoof = state.roofs.draw()
        state.chosenPiece = drawnRoof
        state.visibleRoofs[this.visibleIndex] = false
        this.metadata = { chosenRoof: drawnRoof }
    }
}
