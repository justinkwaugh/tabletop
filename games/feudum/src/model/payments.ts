import { assert } from '@tabletop/common'
import * as Type from 'typebox'
import { Goods, type Good, type GuildId } from '../data/components.js'
import { FarmerPurse, GuildById, type CharityId } from '../data/guilds.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { goodCounts, GoodSchema, TileIdSchema, type GoodCounts } from './stateSchemas.js'
import { barrelRoom, returnGoodToHaversack, takeGoodFromHaversack } from './supply.js'
import { goodsTotal } from './collections.js'

/** R-4.3.3, R-4.4-H1 What every paying action may carry: a good, never shillings. */
export type WildTileSpend = Type.Static<typeof WildTileSpend>
export const WildTileSpend = Type.Object({
    tileId: TileIdSchema,
    good: GoodSchema,
    /** R-4.10.2, R-4.10-H1 A sulfur brought may go straight into the barrel. */
    sulfurToBarrel: Type.Optional(Type.Literal(true))
})

export type GoodPrice = Readonly<Partial<Record<Good, number>>>

/** R-4.6.2 Where a payment's shillings go. */
export interface GuildSplit {
    readonly members: { readonly playerId: string; readonly amount: number }[]
    readonly charity: { readonly id: CharityId; readonly amount: number }
    readonly generalSupply: number
}

/** R-4.6.2, R-4.6-H3 One each to master, journeyman and charity, repeating. */
export function guildSplit(
    state: HydratedFeudumGameState,
    guild: GuildId,
    price: number
): GuildSplit {
    const shares = [0, 0, 0]
    for (let shilling = 0; shilling < price; shilling++) {
        shares[shilling % shares.length] += 1
    }
    const [masterShare, journeymanShare, charityShare] = shares
    const { master, journeyman } = state.guilds.tracks[guild]
    const members = [
        { playerId: master?.playerId, amount: masterShare },
        { playerId: journeyman?.playerId, amount: journeymanShare }
    ].flatMap(({ playerId, amount }) => (playerId ? [{ playerId, amount }] : []))
    return {
        members,
        charity: { id: GuildById[guild].charity, amount: charityShare },
        generalSupply: (master ? 0 : masterShare) + (journeyman ? 0 : journeymanShare)
    }
}

/** R-4.6.2 A member who pays themselves must still hold the full price. */
export function canPayGuild(
    state: HydratedFeudumGameState,
    playerId: string,
    price: number
): boolean {
    return state.getPlayerState(playerId).shillings >= price
}

/** R-4.6.2, R-4.6-H3 Returns the split, for the log. */
export function payGuild(
    state: HydratedFeudumGameState,
    playerId: string,
    guild: GuildId,
    price: number
): GuildSplit {
    assert(canPayGuild(state, playerId, price), `R-4.6.2 ${playerId} does not hold ${price}`)
    const split = guildSplit(state, guild, price)
    state.getPlayerState(playerId).shillings -= price
    for (const member of split.members) {
        state.getPlayerState(member.playerId).shillings += member.amount
    }
    if (split.charity.id === FarmerPurse.id) {
        state.guilds.farmer.purse += split.charity.amount
    } else {
        state.guilds.monk.coffer += split.charity.amount
    }
    state.supply.shillings += split.generalSupply
    return split
}

/** R-4.3.3, R-4.10.2 */
export function canSpendWildTiles(
    state: HydratedFeudumGameState,
    playerId: string,
    wildTiles: readonly WildTileSpend[]
): boolean {
    const held = state.getPlayerState(playerId).regionTiles
    const tileIds = wildTiles.map((spend) => spend.tileId)
    const toBarrel = wildTiles.filter((spend) => spend.sulfurToBarrel)
    return (
        toBarrel.every((spend) => spend.good === 'sulfur') &&
        toBarrel.length <= barrelRoom(state, playerId) &&
        new Set(tileIds).size === tileIds.length &&
        tileIds.every((tileId) => held.includes(tileId)) &&
        Goods.every(
            (good) =>
                wildTiles.filter((spend) => spend.good === good).length <=
                state.supply.haversack[good]
        )
    )
}

/** R-4.3.3, R-4.10.2 Each tile leaves the game for a good of the player's choice from the haversack. */
export function spendWildTiles(
    state: HydratedFeudumGameState,
    playerId: string,
    wildTiles: readonly WildTileSpend[]
): void {
    assert(canSpendWildTiles(state, playerId, wildTiles), `R-4.3.3 ${playerId} cannot spend these`)
    const player = state.getPlayerState(playerId)
    for (const { tileId, good, sulfurToBarrel } of wildTiles) {
        player.regionTiles = player.regionTiles.filter((held) => held !== tileId)
        state.tilesOutOfGame.push(tileId)
        const taken = takeGoodFromHaversack(state, good)
        if (sulfurToBarrel) {
            player.barrel += taken
        } else {
            player.goods[good] += taken
        }
    }
}

/** R-4.4-H1 What the player's goods leave unpaid, before any tile. */
export function goodsShort(
    state: HydratedFeudumGameState,
    playerId: string,
    price: GoodPrice
): GoodCounts {
    const short = goodCounts()
    const { goods } = state.getPlayerState(playerId)
    for (const good of Goods) {
        short[good] = Math.max(0, (price[good] ?? 0) - goods[good])
    }
    return short
}

/** R-4.4-H1 Whether the player's tiles can make up the shortfall: when to offer them. */
export function canCoverWithWildTiles(
    state: HydratedFeudumGameState,
    playerId: string,
    price: GoodPrice
): boolean {
    const short = goodsShort(state, playerId, price)
    const tilesNeeded = goodsTotal(short)
    return (
        tilesNeeded <= state.getPlayerState(playerId).regionTiles.length &&
        Goods.every((good) => short[good] <= state.supply.haversack[good])
    )
}

/** R-4.4-H1 The tiles are spent first, so what they bring to the seat's goods counts toward the price. */
export function canPayGoods(
    state: HydratedFeudumGameState,
    playerId: string,
    price: GoodPrice,
    wildTiles: readonly WildTileSpend[] = []
): boolean {
    if (!canSpendWildTiles(state, playerId, wildTiles)) {
        return false
    }
    const { goods } = state.getPlayerState(playerId)
    return Goods.every((good) => {
        const covered = wildTiles.filter(
            (spend) => spend.good === good && !spend.sulfurToBarrel
        ).length
        return goods[good] + covered >= (price[good] ?? 0)
    })
}

/** R-4.4-H1, R-7 "Turn in": tiles first, then the price goes to the haversack. */
export function payGoods(
    state: HydratedFeudumGameState,
    playerId: string,
    price: GoodPrice,
    wildTiles: readonly WildTileSpend[] = []
): void {
    assert(canPayGoods(state, playerId, price, wildTiles), `R-4.4-H1 ${playerId} falls short`)
    spendWildTiles(state, playerId, wildTiles)
    const { goods } = state.getPlayerState(playerId)
    for (const good of Goods) {
        const amount = price[good] ?? 0
        goods[good] -= amount
        returnGoodToHaversack(state, good, amount)
    }
}
