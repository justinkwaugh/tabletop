import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MasterType } from '../definition/masterType.js'
import { Color } from '@tabletop/common'

export type PlayerTile = Type.Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type BridgesPlayerState = Type.Static<typeof BridgesPlayerState>
export const BridgesPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            pieces: Type.Record(Type.Enum(MasterType), Type.Number()),
            score: Type.Number()
        })
    ])
)

export const BridgesPlayerStateValidator = Compile(BridgesPlayerState)

export class HydratedBridgesPlayerState
    extends Hydratable<typeof BridgesPlayerState>
    implements BridgesPlayerState
{
    declare playerId: string
    declare color: Color
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
