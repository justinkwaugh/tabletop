import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { ActionSpace } from './actionSpaces.js'

export const STARTING_CASH: Record<number, number> = { 3: 13, 4: 10, 5: 8 }

export type HcgPlayerState = Type.Static<typeof HcgPlayerState>
export const HcgPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Number(),
            actionSpace: Type.Optional(Type.Enum(ActionSpace))
        })
    ])
)

export const HcgPlayerStateValidator = Compile(HcgPlayerState)

export class HydratedHcgPlayerState
    extends Hydratable<typeof HcgPlayerState>
    implements HcgPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number
    declare actionSpace?: ActionSpace

    constructor(data: HcgPlayerState) {
        super(data, HcgPlayerStateValidator)
    }
}
