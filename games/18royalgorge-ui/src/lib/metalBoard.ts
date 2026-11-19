import {
    CfiId,
    DepotSourceId,
    GoldDividends,
    PhasesRoyalGorge,
    SteelColumns,
    SteelDepotId,
    colorPhase,
    goldShipmentLimit,
    goldDividend,
    nextSteel,
    steelColumn,
    steelLeft,
    steelPrice,
    ownsOpenPrivate,
    steelChoices,
    steelTurnOf,
    DepotSteelPerTurn,
    type HydratedStateRoyalGorge,
    type SteelPurchase
} from '@tabletop/18royalgorge'
import { finiteCashOwnedBy } from '@tabletop/18xx'

/** A printed space of a steel column, and whether a cube still stands on it. */
export type SteelCube = { price: number; remaining: boolean }

export type SteelColumnView = {
    id: string
    color: string
    /** The column's printed spaces, dearest first as the board prints them, each with its cube or not. */
    cubes: readonly SteelCube[]
    /** What the next steel from it costs: its cheapest cube, or the empty price. */
    price: number
    /**
     * The operating company's column for this colour this turn: used already, chosen, or the
     * cheapest, which the next tile takes unless another is chosen.
     */
    mark?: 'fixed' | 'chosen' | 'next'
    choosable: boolean
}

export type SteelColorView = {
    color: string
    columns: readonly SteelColumnView[]
    /** The operating company's next steel of this colour, while its tiles may be laid. */
    next?: SteelPurchase
}

/** The operating railroad's use of the Steel Depot this turn, while it holds the card (B3). */
export type SteelDepotTurn = {
    /** The next yellow tile takes the depot's steel. */
    on: boolean
    /** The depot's steel taken this turn, of the two allowed. */
    used: number
    /** Whether the railroad may switch to the depot now, or back to the column. */
    choosable: boolean
    /** The yellow column the railroad's steel comes from without the depot. */
    column: string
}

export type SteelDepotView = { steel: number; turn?: SteelDepotTurn }

/** How much more Steel Depot steel the railroad may take this turn, of the two allowed (B3). */
export function depotTurnNote(steel: number, turn: SteelDepotTurn): string {
    const more = Math.min(DepotSteelPerTurn - turn.used, steel)
    if (!turn.used) return `${more} more this turn`
    return `${turn.used} used this turn, ${more ? `${more} more` : 'no more'}`
}

export type SteelBoard = {
    colors: readonly SteelColorView[]
    /** CF&I's treasury, which it pays out at the end of the set (ST-8). */
    cash: number
    /** The Steel Depot, while a railroad owns it (B3). */
    depot?: SteelDepotView
    /** The railroad whose turn's steel the marks show. */
    companyId?: string
}

/**
 * CF&I's steel market as the board prints it, with the operating railroad's columns this turn and
 * which it may still choose (ST-1 to ST-5, B3).
 */
export function steelBoard(state: HydratedStateRoyalGorge, choosing: boolean): SteelBoard {
    const companyId = state.trackStep?.companyId
    const turn = companyId ? steelTurnOf(state, companyId) : undefined
    const laying = !!companyId && !!state.trackStep && !state.trackStep.completed
    const colors = PhasesRoyalGorge.phase(state.phaseId).tileColors
    const choices = laying && companyId && choosing ? steelChoices(state, companyId, colors) : {}
    const next = (color: string) =>
        companyId && laying && colors.includes(color)
            ? nextSteel(state, companyId, color)
            : undefined
    const columnChoosable = (color: string, column: string) =>
        (choices[color]?.length ?? 0) > 1 &&
        !!choices[color]?.includes(column) &&
        next(color)?.source !== column
    const view = Object.entries(SteelColumns).map(([color, columns]): SteelColorView => {
        const fixed = turn?.columns[color]
        const chosen = turn?.choices?.[color]
        const upcoming = next(color)
        return {
            color,
            columns: Object.entries(columns).map(([id, prices]) => {
                const left = steelLeft(state, id)
                return {
                    id,
                    color,
                    cubes: [...prices]
                        .reverse()
                        .map((price, index) => ({ price, remaining: index < left })),
                    price: steelPrice(state, id),
                    ...(fixed === id
                        ? { mark: 'fixed' as const }
                        : upcoming?.source === id
                          ? { mark: chosen === id ? ('chosen' as const) : ('next' as const) }
                          : {}),
                    choosable: columnChoosable(color, id)
                }
            }),
            ...(upcoming ? { next: upcoming } : {})
        }
    })
    const depotInPlay = state.companies.some(
        (company) => company.id === SteelDepotId && !company.closed
    )
    const depotTurn = (railroadId: string): SteelDepotTurn => {
        const on = next('yellow')?.source === DepotSourceId
        const column = steelColumn(state, railroadId, 'yellow')
        return {
            on,
            used: steelTurnOf(state, railroadId).depotSteel,
            choosable: columnChoosable('yellow', on ? column : DepotSourceId),
            column
        }
    }
    return {
        colors: view,
        cash: finiteCashOwnedBy(state, { kind: 'company', companyId: CfiId }),
        ...(depotInPlay && state.depotSteel > 0
            ? {
                  depot: {
                      steel: state.depotSteel,
                      ...(laying && companyId && ownsOpenPrivate(state, companyId, SteelDepotId)
                          ? { turn: depotTurn(companyId) }
                          : {})
                  }
              }
            : {}),
        ...(laying && companyId ? { companyId } : {})
    }
}

export type GoldSpace = { value: number; covered: boolean; open: boolean; last: boolean }

/** VGC's gold track: its spaces from the left, which gold covers and the phase opens (GO-3, GO-4). */
export function goldTrack(state: HydratedStateRoyalGorge): {
    spaces: readonly GoldSpace[]
    dividend: number
    phase: string
} {
    const limit = goldShipmentLimit(state.phaseId)
    return {
        spaces: GoldDividends.map((value, index) => ({
            value,
            covered: index < state.goldShipped,
            open: index < limit,
            last: index === GoldDividends.length - 1
        })),
        dividend: goldDividend(state),
        phase: colorPhase(state.phaseId)
    }
}
