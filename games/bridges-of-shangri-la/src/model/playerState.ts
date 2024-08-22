import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { MasterType } from 'src/components/tiles'

export enum PlayerColor {
    Red = 'red',
    Blue = 'blue',
    Yellow = 'yellow',
    Purple = 'purple'
}

export type PlayerTile = Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type BridgesPlayerState = Static<typeof BridgesPlayerState>
export const BridgesPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        color: Type.Enum(PlayerColor),
        pieces: Type.Record(Type.Enum(MasterType), Type.Number()),
        score: Type.Number()
    })
])

export const BridgesPlayerStateValidator = TypeCompiler.Compile(BridgesPlayerState)

export class HydratedBridgesPlayerState
    extends Hydratable<typeof BridgesPlayerState>
    implements BridgesPlayerState
{
    declare playerId: string
    declare color: PlayerColor
    declare pieces: Record<MasterType, number>
    declare score: number

    constructor(data: BridgesPlayerState) {
        super(data, BridgesPlayerStateValidator)
    }

    hasPiece(masterType: MasterType) {
        return this.pieces[masterType] > 0
    }

    removePiece(masterType: MasterType) {
        if (this.pieces[masterType] === 0) {
            throw Error(`Player ${this.playerId} has no ${masterType} to remove`)
        }

        this.pieces[masterType]--
    }

    addPiece(masterType: MasterType) {
        this.pieces[masterType]++

        if (this.pieces[masterType] > 6) {
            throw Error(`Player ${this.playerId} has too many ${masterType} pieces`)
        }
    }
}
