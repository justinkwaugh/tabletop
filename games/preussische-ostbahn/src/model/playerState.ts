import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'

export type OstbahnPlayerState = Type.Static<typeof OstbahnPlayerState>
export const OstbahnPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Number()
        })
    ])
)

export const OstbahnPlayerStateValidator = Compile(OstbahnPlayerState)

export class HydratedOstbahnPlayerState
    extends Hydratable<typeof OstbahnPlayerState>
    implements OstbahnPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number

    constructor(data: OstbahnPlayerState) {
        super(data, OstbahnPlayerStateValidator)
    }
}
