import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PlayerColor } from '@tabletop/common'
import { Boat } from 'src/components/boat'

export type PlayerTile = Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type KaivaiPlayerState = Static<typeof KaivaiPlayerState>
export const KaivaiPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        score: Type.Number(),
        movementModiferPosition: Type.Number(),
        boats: Type.Array(Boat),
        shells: Type.Array(Type.Number()),
        fish: Type.Array(Type.Number())
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
    declare movementModiferPosition: number
    declare boats: Boat[]
    declare shells: number[]
    declare fish: number[]

    constructor(data: KaivaiPlayerState) {
        super(data, KaivaiPlayerStateValidator)
    }
}
