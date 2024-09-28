import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PlayerColor } from '@tabletop/common'
import { Company } from '../definition/companies.js'

export type EstatesPlayerState = Static<typeof EstatesPlayerState>
export const EstatesPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        certificates: Type.Array(Type.Enum(Company)),
        money: Type.Number(),
        score: Type.Number()
    })
])

export const EstatesPlayerStateValidator = TypeCompiler.Compile(EstatesPlayerState)

export class HydratedEstatesPlayerState
    extends Hydratable<typeof EstatesPlayerState>
    implements EstatesPlayerState
{
    declare playerId: string
    declare color: PlayerColor
    declare certificates: Company[]
    declare money: number
    declare score: number

    constructor(data: EstatesPlayerState) {
        super(data, EstatesPlayerStateValidator)
    }
}