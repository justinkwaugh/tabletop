import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { ActionBox } from './actionBoxes.js'

export type SarPlayerState = Type.Static<typeof SarPlayerState>
export const SarPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Number(),
            locomotive: Type.Enum(ActionBox),
            leaveTownCubes: Type.Number()
        })
    ])
)

export const SarPlayerStateValidator = Compile(SarPlayerState)

export class HydratedSarPlayerState
    extends Hydratable<typeof SarPlayerState>
    implements SarPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number
    declare locomotive: ActionBox
    declare leaveTownCubes: number

    constructor(data: SarPlayerState) {
        super(data, SarPlayerStateValidator)
    }
}
