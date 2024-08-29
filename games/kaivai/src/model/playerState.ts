import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PlayerColor } from '@tabletop/common'

export type PlayerTile = Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type KaivaiPlayerState = Static<typeof KaivaiPlayerState>
export const KaivaiPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        score: Type.Number()
    })
])

export const KaivaiPlayerStateValidator = TypeCompiler.Compile(KaivaiPlayerState)

export class HydratedKaivaiPlayerState
    extends Hydratable<typeof KaivaiPlayerState>
    implements KaivaiPlayerState
{
    declare playerId: string
    declare color: PlayerColor
    declare score: number

    constructor(data: KaivaiPlayerState) {
        super(data, KaivaiPlayerStateValidator)
    }
}
