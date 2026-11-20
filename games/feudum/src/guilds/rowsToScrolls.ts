import type { KnightRowId, ScrollSpaceId } from '../data/guilds.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { changeOwnerSupply, knightRow, knightRows } from '../model/knightRows.js'
import {
    bestScrollCompletions,
    emptyScrollSpaces,
    scrollLinesCompleted,
    type ScrollLines
} from '../model/scrolls.js'
import { moveConcealedSeal } from '../model/seals.js'
import type { GuildFunctionParams, GuildFunctionRow } from './guildFunction.js'
import type { GuildFunctionDetails, KnightRowLeft } from './guildFunctionDetails.js'

/** R-4.6.4, R-4.6.5 Each Knight row holding a marker, by its id. */
function rowsWithMarkers(state: HydratedFeudumGameState): KnightRowId[] {
    return knightRows(state).flatMap(({ rowId, row }) => (row.markers > 0 ? [rowId] : []))
}

/** R-4.6.1, R-4.6-H5, R-4.6-H9 */
function movableToScrolls(state: HydratedFeudumGameState, cap: number): number {
    return Math.min(
        cap,
        rowsWithMarkers(state).length,
        emptyScrollSpaces(state).length,
        state.supply.sealPileCount
    )
}

export interface RowsToScrollsOffer {
    /** R-4.6.1 The most markers that can move now. */
    readonly movable: number
    /** Each row holding a marker, by its id. */
    readonly knightRows: readonly KnightRowId[]
    readonly scrollSpaces: readonly ScrollSpaceId[]
}

/** R-4.6.4, R-4.6.5 What a Knight push or Noble pull can pick now. */
export function rowsToScrollsOffer(
    state: HydratedFeudumGameState,
    cap: number
): RowsToScrollsOffer {
    return {
        movable: movableToScrolls(state, cap),
        knightRows: rowsWithMarkers(state),
        scrollSpaces: emptyScrollSpaces(state)
    }
}

/** R-4.6.1 At least one must move. */
function reasonClosed(state: HydratedFeudumGameState): string | undefined {
    if (rowsWithMarkers(state).length === 0) {
        return 'No Knight row holds a marker.'
    }
    if (emptyScrollSpaces(state).length === 0) {
        return 'No scroll space is empty.'
    }
    return state.supply.sealPileCount === 0 ? 'The general supply has no seal.' : undefined
}

/** R-4.6.4, R-4.6.5 Picks that could be made, read on a staged input too: no minimum. */
function reasonPicksCannotHappen(
    state: HydratedFeudumGameState,
    { knightRows = [], scrollSpaces = [] }: GuildFunctionParams,
    cap: number
): string | undefined {
    const { rows } = state.guilds.knight
    const movable = movableToScrolls(state, cap)
    if (knightRows.length > movable) {
        return `Move at most ${movable} marker${movable === 1 ? '' : 's'}.`
    }
    if (new Set(knightRows).size < knightRows.length) {
        return 'Pick rows of different colours.'
    }
    if (knightRows.some((rowId) => (rows[rowId]?.markers ?? 0) === 0)) {
        return 'That Knight row holds no marker.'
    }
    if (scrollSpaces.length > knightRows.length) {
        return 'Pick one empty scroll space for each marker.'
    }
    const empty = emptyScrollSpaces(state)
    const taken = scrollSpaces.some(
        (spaceId, index) => !empty.includes(spaceId) || scrollSpaces.indexOf(spaceId) < index
    )
    return taken ? 'That scroll space is not empty.' : undefined
}

function rowsLeft(state: HydratedFeudumGameState, rowIds: readonly KnightRowId[]): KnightRowLeft[] {
    return rowIds.map((rowId) => ({ rowId, owner: knightRow(state, rowId).owner }))
}

/** What the picks reached, for the function's own record. */
export interface RowsToScrollsMove extends ScrollLines {
    readonly markers: KnightRowLeft[]
}

export interface RowsToScrollsRules {
    readonly cap: number
    /** R-4.6.4 The stated number must move if it can; R-4.6.5 a range is the actor's to choose. */
    readonly moveAll: boolean
    outcome(
        move: RowsToScrollsMove,
        params: GuildFunctionParams
    ): { readonly details: GuildFunctionDetails; readonly completions: number }
    /** R-4.6.1 The level the best lines reach. */
    reached(lines: number): number
}

/** R-4.6.4, R-4.6.5, R-X.2 The seals stay unseen and in no record, so no barrier. */
export function rowsToScrollsRow(rules: RowsToScrollsRules): GuildFunctionRow {
    const { cap, moveAll, outcome, reached } = rules
    return {
        reasonClosed,

        /** R-4.6.1, R-4.6-H5 */
        reasonRefused(state, _actor, params) {
            const cannot = reasonPicksCannotHappen(state, params, cap)
            if (cannot) {
                return cannot
            }
            const { knightRows = [], scrollSpaces = [] } = params
            const movable = movableToScrolls(state, cap)
            if (knightRows.length === 0) {
                return `Pick up to ${cap} rows of different colours.`
            }
            if (moveAll && knightRows.length < movable) {
                return `${movable} markers can move: move them all.`
            }
            return scrollSpaces.length < knightRows.length
                ? 'Pick one empty scroll space for each marker.'
                : undefined
        },

        /** The seals go first: a projected state defers before any public change. */
        perform(state, _actor, params) {
            const { knightRows = [], scrollSpaces = [] } = params
            const lines = scrollLinesCompleted(state, scrollSpaces)
            const markers = rowsLeft(state, knightRows)
            for (const spaceId of scrollSpaces) {
                moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId })
            }
            for (const rowId of knightRows) {
                const row = knightRow(state, rowId)
                row.markers -= 1
                changeOwnerSupply(state, { rowId, row }, 1)
            }
            return outcome({ ...lines, markers }, params)
        },

        /** R-4.6.1 Public occupancy alone; a staged input short of the count is read too. */
        preview(state, _actor, params) {
            if (reasonPicksCannotHappen(state, params, cap)) {
                return undefined
            }
            const { knightRows = [], scrollSpaces = [] } = params
            const lines = scrollLinesCompleted(state, scrollSpaces)
            const markers = rowsLeft(state, knightRows)
            return { ...outcome({ ...lines, markers }, params), ...lines }
        },

        /** R-4.6.1 More seals never complete less, so the most that can move is the best. */
        bestCompletions(state) {
            return reached(bestScrollCompletions(state, movableToScrolls(state, cap)))
        }
    }
}
