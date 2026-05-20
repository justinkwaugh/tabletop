import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type UrbinoPlayerState = Type.Static<typeof UrbinoPlayerState>
export const UrbinoPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            houses: Type.Number(),
            palaces: Type.Number(),
            towers: Type.Number(),
            score: Type.Number(),
        })
    ])
)

export const UrbinoPlayerStateValidator = Compile(UrbinoPlayerState)

export class HydratedUrbinoPlayerState
    extends Hydratable<typeof UrbinoPlayerState>
    implements UrbinoPlayerState
{
    declare playerId: string
    declare color: Color
    declare houses: number
    declare palaces: number
    declare towers: number
    declare score: number

    constructor(data: UrbinoPlayerState) {
        super(data, UrbinoPlayerStateValidator)
    }

    get remainingBuildings(): { houses: number; palaces: number; towers: number } {
        return { houses: this.houses, palaces: this.palaces, towers: this.towers }
    }

    get hasBuildings(): boolean {
        return this.houses > 0 || this.palaces > 0 || this.towers > 0
    }
}
