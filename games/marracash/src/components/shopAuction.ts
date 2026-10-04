import { Hydratable, HydratedSimultaneousAuction, SimultaneousAuction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ShopIds, type ShopId } from './board.js'

export type ShopAuction = Type.Static<typeof ShopAuction>
export const ShopAuction = Type.Object({
    shopId: Type.Enum(ShopIds),
    bidding: SimultaneousAuction
})

const ShopAuctionValidator = Compile(ShopAuction)

export class HydratedShopAuction extends Hydratable<typeof ShopAuction> implements ShopAuction {
    declare shopId: ShopId
    declare bidding: HydratedSimultaneousAuction

    constructor(data: ShopAuction) {
        super(data, ShopAuctionValidator)
        this.bidding = new HydratedSimultaneousAuction(data.bidding)
    }

    awaitingBidderIds(): string[] {
        return this.bidding.participants
            .filter((participant) => !participant.submitted)
            .map((participant) => participant.playerId)
    }
}
