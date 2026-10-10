import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Side } from '../components/pieces.js'

export type NapoleonsTriumphPlayerState = Type.Static<typeof NapoleonsTriumphPlayerState>
export const NapoleonsTriumphPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            /** Absent until sides are settled by the morale auction. */
            side: Type.Optional(Type.Enum(Side)),
            morale: Type.Integer(),
            /** Morale points lost so far, for the night recovery (rule 14). */
            moraleLost: Type.Integer({ minimum: 0 }),
            corpsCommandsUsed: Type.Integer({ minimum: 0 }),
            independentCommandsUsed: Type.Integer({ minimum: 0 }),
            heavyCavalryCommitted: Type.Boolean(),
            guardCommitted: Type.Boolean(),
            guardAttackForfeited: Type.Boolean()
        })
    ])
)

export const NapoleonsTriumphPlayerStateValidator = Compile(NapoleonsTriumphPlayerState)

export class HydratedNapoleonsTriumphPlayerState
    extends Hydratable<typeof NapoleonsTriumphPlayerState>
    implements NapoleonsTriumphPlayerState
{
    declare playerId: string
    declare color: Color
    declare side?: Side
    declare morale: number
    declare moraleLost: number
    declare corpsCommandsUsed: number
    declare independentCommandsUsed: number
    declare heavyCavalryCommitted: boolean
    declare guardCommitted: boolean
    declare guardAttackForfeited: boolean

    constructor(data: NapoleonsTriumphPlayerState) {
        super(data, NapoleonsTriumphPlayerStateValidator)
    }
}
