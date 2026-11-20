import { assertExists } from '@tabletop/common'
import { Goods, VesselTypes } from '../data/components.js'
import { KnightSections, KrudBarrels, VesselInventions } from '../data/guilds.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { changeOwnerSupply, knightRows, ownerSupply } from '../model/knightRows.js'
import { cartsHold, takeFromCart } from '../model/market.js'
import { goodCounts, type GoodCounts } from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import type { InventionChoice, RowFill } from './guildFunctionDetails.js'

const InventionChoices: readonly InventionChoice[] = [...VesselTypes, 'krud-barrel']

/** R-4.6.6 Spaces left in the row's leading unfilled section; none when the row is full. */
function leadingSectionRoom(markers: number): number {
    let end = 0
    for (const { spaces } of KnightSections) {
        end += spaces
        if (markers < end) {
            return end - markers
        }
    }
    return 0
}

type RowsAndSupply = Pick<HydratedFeudumGameState, 'guilds' | 'supply'>

/** R-4.6.6, R-4.6-H8 One barrel: every row's leading unfilled section, as far as its owner's supply has. */
function fillLeadingSections(state: RowsAndSupply): RowFill[] {
    return knightRows(state).flatMap(({ rowId, row }) => {
        const added = Math.min(leadingSectionRoom(row.markers), ownerSupply(state, { rowId, row }))
        if (added === 0) {
            return []
        }
        row.markers += added
        changeOwnerSupply(state, { rowId, row }, -added)
        return [{ rowId, owner: row.owner, added }]
    })
}

/** R-4.6.6, R-4.6-H8 How many barrels can be invented: each needs a row with an unfilled section. */
function barrelsLeft(state: HydratedFeudumGameState): number {
    const trial = structuredClone({ guilds: state.guilds, supply: state.supply })
    let barrels = 0
    while (
        barrels < KrudBarrels.length &&
        knightRows(trial).some(({ row }) => leadingSectionRoom(row.markers) > 0)
    ) {
        fillLeadingSections(trial)
        barrels += 1
    }
    return barrels
}

/** R-4.6.5, R-4.6-H4 What these inventions use; a barrel's price is its place among these barrels. */
export function inventionGoods(inventions: readonly InventionChoice[]): GoodCounts {
    const used = goodCounts()
    let barrels = 0
    for (const invention of inventions) {
        const row =
            invention === 'krud-barrel'
                ? KrudBarrels.at(barrels++)
                : VesselInventions.find(({ vessel }) => vessel === invention)
        assertExists(row, `R-4.6.5 ${invention} has a price here`)
        for (const good of Goods) {
            used[good] += row.recipe[good] ?? 0
        }
    }
    return used
}

/** R-4.6.5, R-4.6.6 Whether these could be made, up to `cap`. No minimum: a staged input is read. */
export function reasonInventionsRefused(
    state: HydratedFeudumGameState,
    inventions: readonly InventionChoice[],
    cap: number
): string | undefined {
    if (inventions.length > cap) {
        return `Invent at most ${cap}.`
    }
    const barrels = inventions.filter((invention) => invention === 'krud-barrel').length
    const used = inventionGoods(inventions)
    const holds = cartsHold(state)
    const short = Goods.find((good) => used[good] > holds[good])
    if (short) {
        return `That needs ${used[short]} ${short}; the carts and piles hold ${holds[short]}.`
    }
    const out = VesselTypes.find(
        (vessel) =>
            inventions.filter((invention) => invention === vessel).length >
            state.supply.vessels[vessel]
    )
    if (out) {
        return `The general supply has only ${state.supply.vessels[out]} ${out.replace('-', ' ')}.`
    }
    return barrels > barrelsLeft(state) ? 'No Knight row has an unfilled section left.' : undefined
}

export interface InventionsMade {
    readonly goodsUsed: GoodCounts
    readonly barrels: RowFill[][]
}

/** R-4.6.5, R-4.6.6 The caller has checked the input. */
export function makeInventions(
    state: HydratedFeudumGameState,
    inventions: readonly InventionChoice[]
): InventionsMade {
    const goodsUsed = inventionGoods(inventions)
    for (const good of Goods) {
        for (let index = 0; index < goodsUsed[good]; index++) {
            takeFromCart(state, good)
        }
        returnGoodToHaversack(state, good, goodsUsed[good])
    }
    const barrels: RowFill[][] = []
    for (const invention of inventions) {
        if (invention === 'krud-barrel') {
            barrels.push(fillLeadingSections(state))
        } else {
            state.supply.vessels[invention] -= 1
            state.guilds.alchemist.vesselsForSale.push(invention)
        }
    }
    return { goodsUsed, barrels }
}

export interface InventionOffer {
    readonly invention: InventionChoice
    /** R-4.6.5 What one costs as the first of this action. */
    readonly goods: GoodCounts
    /** Set when it cannot be made now. */
    readonly reason?: string
}

/** R-4.6.5 Each invention, priced as the first of this action. */
export function inventionOffers(state: HydratedFeudumGameState): InventionOffer[] {
    return InventionChoices.map((invention) => {
        const reason = reasonInventionsRefused(state, [invention], 1)
        return { invention, goods: inventionGoods([invention]), ...(reason ? { reason } : {}) }
    })
}

/** R-4.6.5 The most inventions that can be made now, up to `cap`, trying every mix. */
export function mostInventions(state: HydratedFeudumGameState, cap: number): number {
    const mixes = (size: number, from: number): InventionChoice[][] =>
        size === 0
            ? [[]]
            : InventionChoices.slice(from).flatMap((invention, index) =>
                  mixes(size - 1, from + index).map((rest) => [invention, ...rest])
              )
    for (let size = cap; size > 0; size--) {
        if (mixes(size, 0).some((mix) => !reasonInventionsRefused(state, mix, cap))) {
            return size
        }
    }
    return 0
}
