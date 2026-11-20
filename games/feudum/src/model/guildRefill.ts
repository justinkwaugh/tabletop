import { shuffle } from '@tabletop/common'
import * as Type from 'typebox'
import { VesselTypes, type VesselType } from '../data/components.js'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    FarmerBarn,
    GuildSetupSpaces,
    MarketSpaces
} from '../data/guilds.js'
import { drawGoods } from './haversack.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { KnightRowOwner } from './guildsState.js'
import { changeOwnerSupply, knightRows, ownerSupply } from './knightRows.js'
import { goodsTotal } from './market.js'
import { flipSeal, moveConcealedSeal } from './seals.js'
import {
    ChickenSpaceIdSchema,
    ComponentCount,
    GoodSchema,
    KnightRowIdSchema,
    ScrollSpaceIdSchema,
    SealIdSchema,
    VesselTypeSchema
} from './stateSchemas.js'
import { takeGoodFromHaversack } from './supply.js'

/** R-4.12.5, R-4.12-H2 What the third dawn added, guild by guild, in the order it was added. */
export type GuildRefill = Type.Static<typeof GuildRefill>
export const GuildRefill = Type.Object({
    market: Type.Array(Type.Enum(MarketSpaces.map((space) => space.id))),
    carts: Type.Array(Type.Enum(AlchemistCartSpaces.map((space) => space.id))),
    vessels: Type.Array(VesselTypeSchema),
    knightRows: Type.Array(
        Type.Object({
            rowId: KnightRowIdSchema,
            /** R-1.4-H1 A seat's row, or a dummy row. */
            owner: KnightRowOwner,
            added: ComponentCount
        })
    ),
    scrolls: Type.Array(ScrollSpaceIdSchema),
    /** R-5-H1 A flip names the bead; the seals on the scrolls stay concealed. */
    rosary: Type.Array(SealIdSchema),
    chickens: Type.Array(Type.Object({ space: ChickenSpaceIdSchema, bead: SealIdSchema })),
    barn: Type.Array(GoodSchema)
})

/** R-1.3 Drawn blind from those in the supply, so several may be of one type. */
export function drawVesselsForSale(state: HydratedFeudumGameState, count: number): VesselType[] {
    const { vessels } = state.supply
    const pool = VesselTypes.flatMap((vessel): VesselType[] =>
        Array.from({ length: vessels[vessel] }, () => vessel)
    )
    shuffle(pool, state.getProtectedPrng().random)
    const drawn = pool.slice(0, count)
    for (const vessel of drawn) {
        vessels[vessel] -= 1
    }
    state.guilds.alchemist.vesselsForSale.push(...drawn)
    return drawn
}

/** R-4.12.5, R-1.1-H1 Each empty space setup filled, while its good remains in the haversack. */
function refillMarket(state: HydratedFeudumGameState): GuildRefill['market'] {
    const { market } = state.guilds.merchant
    return MarketSpaces.filter((space) => space.filledAtSetup && !market[space.id]).flatMap(
        (space) => {
            if (takeGoodFromHaversack(state, space.good) === 0) {
                return []
            }
            market[space.id] = true
            return [space.id]
        }
    )
}

/** R-4.12.5, R-1.1-H1 */
function refillCarts(state: HydratedFeudumGameState): GuildRefill['carts'] {
    const { carts } = state.guilds.alchemist
    return AlchemistCartSpaces.filter((space) => space.filledAtSetup && !carts[space.id]).flatMap(
        (space) => {
            if (takeGoodFromHaversack(state, space.good) === 0) {
                return []
            }
            carts[space.id] = true
            return [space.id]
        }
    )
}

/** R-4.12-H2 The vessel space is covered by its count, with any extras staying. */
function refillVessels(state: HydratedFeudumGameState): VesselType[] {
    const { vesselsForSale } = state.guilds.alchemist
    const short = GuildSetupSpaces.alchemist.vessels - vesselsForSale.length
    return drawVesselsForSale(state, Math.max(short, 0))
}

/** R-4.12.5, R-1.1-H1 Every row, dummy rows too, from its owner's markers in the general supply. */
function refillKnightRows(state: HydratedFeudumGameState): GuildRefill['knightRows'] {
    return knightRows(state).flatMap(({ rowId, row }) => {
        const short = GuildSetupSpaces.knight.markersPerRow - row.markers
        const added = Math.min(Math.max(short, 0), ownerSupply(state, { rowId, row }))
        if (added === 0) {
            return []
        }
        row.markers += added
        changeOwnerSupply(state, { rowId, row }, -added)
        return [{ rowId, owner: row.owner, added }]
    })
}

/** R-4.12.5, R-5-H1 Seals stay red side up on the scrolls, from the top of the pile. */
function refillScrolls(state: HydratedFeudumGameState): GuildRefill['scrolls'] {
    const { scrolls } = state.guilds.noble
    return GuildSetupSpaces.noble.scrollSpaces
        .filter((spaceId) => !scrolls[spaceId])
        .flatMap((spaceId) => {
            if (state.supply.sealPileCount === 0) {
                return []
            }
            moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId })
            return [spaceId]
        })
}

/** R-4.12-H2 The rosary is covered by its count, with any extras staying. */
function refillRosary(state: HydratedFeudumGameState): GuildRefill['rosary'] {
    const { monk } = state.guilds
    const beads: GuildRefill['rosary'] = []
    while (monk.rosary.length < GuildSetupSpaces.monk.beads && state.supply.sealPileCount > 0) {
        beads.push(flipSeal(state, { kind: 'pile' }, { kind: 'rosary' }))
    }
    return beads
}

/** R-4.12-H2, R-1.4-H3 Only the setup chicken, and only if nothing covers it. */
function refillChickens(state: HydratedFeudumGameState): GuildRefill['chickens'] {
    const { chickens } = state.guilds.farmer
    return ChickenSpaces.flatMap(({ id: space, setupBead }) => {
        if (!setupBead || chickens[space] !== null || state.supply.sealPileCount === 0) {
            return []
        }
        return [{ space, bead: flipSeal(state, { kind: 'pile' }, { kind: 'chicken', space }) }]
    })
}

/** R-4.12.5, R-5.2 Random goods up to the barn's setup count. */
function refillBarn(state: HydratedFeudumGameState): GuildRefill['barn'] {
    const { barn } = state.guilds.farmer
    const drawn = drawGoods(state, FarmerBarn.setupGoods - goodsTotal(barn))
    for (const good of drawn) {
        barn[good] += 1
    }
    return drawn
}

/** R-4.12.5, R-4.12-H2 The order of the draws is permanent: recorded games depend on it. */
export function refillGuilds(state: HydratedFeudumGameState): GuildRefill {
    return {
        market: refillMarket(state),
        carts: refillCarts(state),
        vessels: refillVessels(state),
        knightRows: refillKnightRows(state),
        scrolls: refillScrolls(state),
        rosary: refillRosary(state),
        chickens: refillChickens(state),
        barn: refillBarn(state)
    }
}
