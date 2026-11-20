import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    actsFor,
    stepAction,
    titleAction,
    type ConstructionState,
    type Owner
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CfiId, SteelDepotId } from './ids.js'
import { ownsOpenPrivate } from './privateHoldings.js'
import { PhasesRoyalGorge } from './trains.js'
import {
    requireStateRoyalGorge,
    type HydratedStateRoyalGorge,
    type SteelMarket,
    type SteelTurn
} from './state.js'

/** What steel costs once a column is empty, or for a silver tile (ST-4, ST-5). */
export const EmptyColumnPrice = 40

/** The steel market's columns by tile colour, each with its cubes' prices, cheapest first. */
export const SteelColumns: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = {
    yellow: { A: [0, 10, 20, 30], B: [0, 10, 20, 30], C: [0, 10, 20, 30], D: [0, 10, 20, 30] },
    green: { E: [20, 30], F: [20, 30] },
    brown: { G: [30], H: [30] },
    gray: { I: [] }
}

/** The pseudo-column that takes yellow steel from the Steel Depot card (B3). */
export const DepotSourceId = 'depot'
/** The Steel Depot gives at most two steel a turn (B3). */
export const DepotSteelPerTurn = 2

export const SteelRecipient: Owner = { kind: 'company', companyId: CfiId }

/** A full market, as set up and refilled at the end of every set (Setup step 9, EG-1). */
export function freshSteelMarket(): SteelMarket {
    return Object.fromEntries(
        Object.values(SteelColumns).flatMap((columns) =>
            Object.entries(columns)
                .filter(([, prices]) => prices.length)
                .map(([column, prices]) => [column, prices.length])
        )
    )
}

/** A column's printed prices, cheapest first. */
function columnPrices(column: string): readonly number[] {
    const prices = Object.values(SteelColumns).find((columns) => column in columns)?.[column]
    assertExists(prices, `Steel column ${column} is printed`)
    return prices
}

/** What the column's next cube costs: its cheapest left, or the empty price (ST-1, ST-4). */
export function steelPrice(state: object, column: string): number {
    const remaining = steelLeft(state, column)
    const prices = columnPrices(column)
    return remaining ? prices[prices.length - remaining] : EmptyColumnPrice
}

/** The cubes left in a printed column; a column printed without cubes is never stored. */
export function steelLeft(state: object, column: string): number {
    columnPrices(column)
    return requireStateRoyalGorge(state).steelMarket[column] ?? 0
}

export function columnColor(column: string): string | undefined {
    return Object.entries(SteelColumns).find(([, columns]) => column in columns)?.[0]
}

function turnOf(state: HydratedStateRoyalGorge, companyId: string): SteelTurn {
    return state.steelTurn?.companyId === companyId
        ? state.steelTurn
        : { companyId, columns: {}, depotSteel: 0 }
}

/** The company's steel this turn: columns used and chosen, and what it has bought (ST-2). */
export function steelTurnOf(state: object, companyId: string): SteelTurn {
    return turnOf(requireStateRoyalGorge(state), companyId)
}

/**
 * The column the company's next tile of the colour takes its steel from, the Steel Depot aside:
 * the one used this turn, else the one chosen, else the cheapest (ST-2, ST-3).
 */
export function steelColumn(state: object, companyId: string, color: string): string {
    const title = requireStateRoyalGorge(state)
    const turn = turnOf(title, companyId)
    const fixed = turn.columns[color]
    if (fixed) return fixed
    const chosen = turn.choices?.[color]
    if (chosen && chosen !== DepotSourceId) return chosen
    const columns = Object.keys(SteelColumns[color] ?? {})
    assert(columns.length > 0, `No steel columns for ${color} tiles`)
    const price = (column: string) => steelPrice(title, column)
    return columns.reduce((best, column) => (price(column) < price(best) ? column : best))
}

/** Whether the company's yellow tiles may still take Steel Depot steel this turn (B3). */
function depotOpen(state: HydratedStateRoyalGorge, companyId: string): boolean {
    return (
        state.depotSteel > 0 &&
        turnOf(state, companyId).depotSteel < DepotSteelPerTurn &&
        ownsOpenPrivate(state, companyId, SteelDepotId)
    )
}

/** Whether the next yellow tile takes its steel from the Steel Depot (B3). */
function usesDepot(state: HydratedStateRoyalGorge, companyId: string, color: string): boolean {
    return (
        color === 'yellow' &&
        turnOf(state, companyId).choices?.yellow === DepotSourceId &&
        depotOpen(state, companyId)
    )
}

/** The column, or the Steel Depot, chosen or used for the colour this turn, if either. */
function currentSource(
    state: HydratedStateRoyalGorge,
    companyId: string,
    color: string
): string | undefined {
    const turn = turnOf(state, companyId)
    return turn.choices?.[color] ?? turn.columns[color]
}

export type SteelPurchase = { source: string; price: number }

/** Where the next tile of the colour gets its steel and what it costs (Rule 5). */
export function nextSteel(state: object, companyId: string, color: string): SteelPurchase {
    const title = requireStateRoyalGorge(state)
    if (usesDepot(title, companyId, color)) return { source: DepotSourceId, price: 0 }
    const column = steelColumn(title, companyId, color)
    return { source: column, price: steelPrice(title, column) }
}

/** Buys the steel for a tile just laid: a cube leaves its column, or the Steel Depot. */
export function buySteel(state: object, companyId: string, color: string): SteelPurchase {
    const title = requireStateRoyalGorge(state)
    const purchase = nextSteel(title, companyId, color)
    const turn = turnOf(title, companyId)
    if (purchase.source === DepotSourceId) {
        title.depotSteel -= 1
        title.steelTurn = { ...turn, depotSteel: turn.depotSteel + 1 }
        return purchase
    }
    const remaining = steelLeft(title, purchase.source)
    if (remaining) title.steelMarket = { ...title.steelMarket, [purchase.source]: remaining - 1 }
    title.steelTurn = { ...turn, columns: { ...turn.columns, [color]: purchase.source } }
    return purchase
}

/** The columns, and the Steel Depot, the company may still choose for each colour this turn. */
export function steelChoices(
    state: ConstructionState,
    companyId: string,
    colors: readonly string[]
): Record<string, string[]> {
    const title = requireStateRoyalGorge(state)
    const turn = turnOf(title, companyId)
    return Object.fromEntries(
        colors
            .filter((color) => color !== 'gray')
            .map((color) => {
                const fixed = turn.columns[color]
                const columns = fixed ? [fixed] : Object.keys(SteelColumns[color] ?? {})
                const depot = color === 'yellow' && depotOpen(title, companyId)
                return [color, depot ? [...columns, DepotSourceId] : columns]
            })
    )
}

const ChooseSteelAction = titleAction('ChooseSteel', {
    companyId: Type.String({ minLength: 1 }),
    color: Type.String({ minLength: 1 }),
    /** A column of the colour, or the Steel Depot for yellow. */
    column: Type.String({ minLength: 1 })
})
export const ChooseSteel = ChooseSteelAction.schema
export type ChooseSteel = Type.Static<typeof ChooseSteel>
export const isChooseSteel = ChooseSteelAction.is

/**
 * The operating company picks the steel column for a colour of tile, or the Steel Depot for
 * yellow; a column already used this turn stays its column for that colour (ST-2, B3).
 */
export class HydratedChooseSteel extends ChooseSteelAction.Base {
    declare playerId: string
    declare companyId: string
    declare color: string
    declare column: string
    isValid(state: HydratedStateRoyalGorge): boolean {
        const step = state.trackStep
        return (
            this.source === ActionSource.User &&
            !!step &&
            !step.completed &&
            step.companyId === this.companyId &&
            actsFor(state, this.playerId, this.companyId) &&
            (steelChoices(state, this.companyId, [this.color])[this.color] ?? []).includes(
                this.column
            ) &&
            currentSource(state, this.companyId, this.color) !== this.column
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'This steel cannot be chosen now')
        const turn = turnOf(state, this.companyId)
        state.steelTurn = { ...turn, choices: { ...turn.choices, [this.color]: this.column } }
    }
}

export const ChooseSteelStep = stepAction<HydratedStateRoyalGorge, HydratedChooseSteel>(
    ChooseSteelAction.type,
    (action): action is HydratedChooseSteel => action instanceof HydratedChooseSteel,
    (state, playerId) => {
        const step = state.trackStep
        return (
            !!step &&
            !step.completed &&
            actsFor(state, playerId, step.companyId) &&
            Object.values(
                steelChoices(
                    state,
                    step.companyId,
                    PhasesRoyalGorge.phase(state.phaseId).tileColors
                )
            ).some((sources) => sources.length > 1)
        )
    }
)

export const SteelActions = [ChooseSteelAction.define((action) => new HydratedChooseSteel(action))]
