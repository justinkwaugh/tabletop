import { Hydratable, OffsetTupleCoordinates, PlayerState } from '@tabletop/common'
import { GoodsType } from '../definition/goodsType.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { type ScoringInfo } from '../util/scoring.js'
import { Color } from '@tabletop/common'

export type PlayerStall = Type.Static<typeof PlayerStall>
export const PlayerStall = Type.Object({
    goodsType: Type.Enum(GoodsType),
    placed: Type.Boolean({ default: false }),
    path: Type.Optional(Type.Array(OffsetTupleCoordinates)),
    distance: Type.Optional(Type.Number()),
    coords: Type.Optional(OffsetTupleCoordinates)
})

export type FreshFishPlayerState = Type.Static<typeof FreshFishPlayerState>
export const FreshFishPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Number(),
            score: Type.Number(),
            stalls: Type.Array(PlayerStall),
            disks: Type.Number()
        })
    ])
)

export const FreshFishPlayerStateValidator = Compile(FreshFishPlayerState)

export class HydratedFreshFishPlayerState
    extends Hydratable<typeof FreshFishPlayerState>
    implements FreshFishPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare score: number
    declare stalls: PlayerStall[]
    declare disks: number

    constructor(data: FreshFishPlayerState) {
        super(data, FreshFishPlayerStateValidator)
    }

    hasDisk(): boolean {
        return this.disks > 0
    }

    hasDiskOnBoard(): boolean {
        return this.disks < 6
    }

    removeDisk() {
        if (!this.hasDisk()) {
            throw Error(`Trying to remove a disk from player ${this.playerId} but he has none`)
        }
        this.disks -= 1
    }

    addDisks(amount: number) {
        this.disks += amount
        if (this.disks > 6) {
            throw Error(`Somehow player ${this.playerId} got too many disks... now ${this.disks}`)
        }
    }

    hasUnplacedStall(goodsType: GoodsType): boolean {
        const stall = this.findStall(goodsType)
        return stall.placed === false
    }

    placeStall(goodsType: GoodsType, coords?: OffsetTupleCoordinates) {
        const stall = this.findStall(goodsType)
        if (stall.placed) {
            throw Error(`${goodsType} stall for player ${this.playerId} was already placed`)
        }
        stall.placed = true
        stall.coords = coords
    }

    findStall(goodsType: GoodsType): PlayerStall {
        const stall = this.stalls.find((playerStall) => playerStall.goodsType === goodsType)
        if (!stall) {
            throw Error(`No ${goodsType} stall found for player ${this.playerId}`)
        }
        return stall
    }

    updateScore(scoringInfo: ScoringInfo) {
        this.score = scoringInfo.score
        for (const stall of this.stalls) {
            stall.path = scoringInfo.paths[stall.goodsType]
            if (stall.path && stall.path.length > 0) {
                stall.distance = stall.path.length - 2
            }
        }
    }
}
