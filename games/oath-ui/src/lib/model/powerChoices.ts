import {
    PowerChoiceKind,
    usableFavor,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice,
    type Suit,
    type WarbandGroup
} from '@tabletop/oath'
import { bargainChoices, type BargainPick } from './bargainPicks.js'
import { exchangeComplete, noExchangePicks, type ExchangePicks } from './exchangeTerms.js'
import type { MovePick } from './powerMoves.js'

export type PowerChoicePicks = {
    option: Record<number, number>
    count: Record<number, number>
    terms: Record<number, ExchangePicks>
    several: Record<number, number[]>
    /** A warband grid's counts, keyed by `gridKey`: its first spec and the group's row. */
    warbands: Record<string, number>
    /** Witch's Bargain from revision 7: the players picked, in order, and what each is given. */
    bargain: Record<number, BargainPick[]>
    /** A power's moves (Messenger, Warning Signals), each keyed by the place, owner and site picked. */
    moves: MovePick[]
}

export function emptyPicks(): PowerChoicePicks {
    return { option: {}, count: {}, terms: {}, several: {}, warbands: {}, bargain: {}, moves: [] }
}

/** Anything picked at all: Undo past the last pick leaves the picks. */
export function hasPicks(picks: PowerChoicePicks): boolean {
    return (
        picks.moves.length > 0 ||
        [
            picks.option,
            picks.count,
            picks.terms,
            picks.several,
            picks.warbands,
            picks.bargain
        ].some((record) => Object.keys(record).length > 0)
    )
}

export const NO_OPTION = -1

/**
 * R-7.1.2 — in a game created before revision 7, an open count (Witch's Bargain) stops at what the
 * player can give: their secrets, or the favor they can use, which Vow of Kinship keeps in a bank.
 * The engine judges the pair.
 */
export function openCountCeiling(
    state: HydratedOathGameState,
    playerId: string | undefined
): number {
    if (playerId === undefined) return 0
    return Math.max(usableFavor(state, playerId), state.getPlayerState(playerId).secrets)
}

/** The favor banks among a choice's options, in option order. */
export function favorBankSuits(options: readonly PowerChoice[]): Suit[] {
    return options.flatMap((option) =>
        option.kind === PowerChoiceKind.FavorBank ? [option.suit] : []
    )
}

/** R-10.8 — the players an exchange may be negotiated with, in option order. */
export function exchangePartners(options: readonly PowerChoice[]): string[] {
    return options.flatMap((option) =>
        option.kind === PowerChoiceKind.Exchange ? [option.withPlayerId] : []
    )
}

/** The players a choice may name, in option order. */
export function playerOptions(options: readonly PowerChoice[]): string[] {
    return options.flatMap((option) =>
        option.kind === PowerChoiceKind.Player ? [option.playerId] : []
    )
}

export function allowsSeveral(legal: LegalChoice): boolean {
    return legal.spec.max > 1
}

/**
 * R-7.1.3 — a power's warbands picked as rows of pieces, one row per group its domain offers,
 * every count starting at none. A grid answers one spec that takes several groups (the Obsidian
 * Cage), or a run of one-group specs over one domain (Terror Spells' two picks), whose groups are
 * sent in the rows' order, the first to the first spec.
 */
export type WarbandGrid = {
    specs: number[]
    groups: WarbandGroup[]
    /** The most the rows may come to together: the power's `together`, else all they hold. */
    total: number
    /** The picks must come to `total` exactly (Terror Spells' two, or all when fewer). */
    exact: boolean
    /** A count goes in multiples of it (Blood Pact's pairs). */
    step: number
    /** The most rows with a count, and the least. */
    most: number
    least: number
    /**
     * The one spec offers each colour once per place it may go, each row carrying all the source
     * holds (the Cage, a row per board, R-7.1.3-H1): a colour's rows share it.
     */
    shared: boolean
    /** Two groups stand in one place (two owners' warbands), so a row names its owner. */
    namesOwners: boolean
}

function groupOf(option: PowerChoice | undefined): WarbandGroup | undefined {
    return option?.kind === PowerChoiceKind.Warbands ? option.group : undefined
}

function groupsOf(legal: LegalChoice): WarbandGroup[] {
    return legal.options.flatMap((option) => {
        const group = groupOf(option)
        return group ? [group] : []
    })
}

/** What the rows hold together: a shared colour counted once. */
function heldTogether(groups: readonly WarbandGroup[], shared: boolean): number {
    if (!shared) return groups.reduce((n, group) => n + group.count, 0)
    const byOwner = new Map<string, number>()
    for (const group of groups) {
        byOwner.set(group.owner, Math.max(byOwner.get(group.owner) ?? 0, group.count))
    }
    return [...byOwner.values()].reduce((n, count) => n + count, 0)
}

function sameDomain(one: LegalChoice, other: LegalChoice): boolean {
    return (
        one.spec.together === other.spec.together &&
        JSON.stringify(one.options) === JSON.stringify(other.options)
    )
}

export function warbandGrids(choices: readonly LegalChoice[]): WarbandGrid[] {
    const grids: WarbandGrid[] = []
    let index = 0
    while (index < choices.length) {
        const legal = choices[index]
        if (legal.spec.kind !== PowerChoiceKind.Warbands) {
            index += 1
            continue
        }
        const specs = [index]
        if (!allowsSeveral(legal)) {
            while (
                specs.length + index < choices.length &&
                choices[index + specs.length].spec.kind === PowerChoiceKind.Warbands &&
                !allowsSeveral(choices[index + specs.length]) &&
                sameDomain(legal, choices[index + specs.length])
            ) {
                specs.push(index + specs.length)
            }
        }
        const shared = allowsSeveral(legal)
        const groups = groupsOf(legal)
        const held = heldTogether(groups, shared)
        const together = legal.spec.together
        const places = new Set(groups.map((group) => JSON.stringify(group.at)))
        grids.push({
            specs,
            groups,
            total: together === undefined ? held : Math.min(together, held),
            exact: together !== undefined,
            step: legal.spec.step ?? 1,
            most: shared ? legal.spec.max : specs.length,
            least: shared
                ? legal.spec.min
                : specs.filter((spec) => choices[spec].spec.min > 0).length,
            shared,
            namesOwners: places.size < groups.length
        })
        index += specs.length
    }
    return grids
}

function gridKey(grid: WarbandGrid, row: number): string {
    return `${grid.specs[0]}:${row}`
}

export function gridCounts(grid: WarbandGrid, picks: PowerChoicePicks): number[] {
    return grid.groups.map((_, row) => picks.warbands[gridKey(grid, row)] ?? 0)
}

function sum(counts: readonly number[]): number {
    return counts.reduce((n, count) => n + count, 0)
}

/**
 * The most a row may be set to with the other rows as they are: what its group holds (less what
 * the colour's other rows take, where they share it), what the total leaves, and none once as
 * many other rows have a count as the power takes groups; held to its step.
 */
export function gridCeilingAt(grid: WarbandGrid, counts: readonly number[], row: number): number {
    const group = grid.groups[row]
    if (!group) return 0
    const others = counts.map((count, i) => (i === row ? 0 : count))
    const rowsTaken = others.filter((count) => count > 0).length
    if (rowsTaken >= grid.most) return 0
    const sameColour = grid.shared
        ? sum(others.filter((_, i) => grid.groups[i]?.owner === group.owner))
        : 0
    const ceiling = Math.max(0, Math.min(group.count - sameColour, grid.total - sum(others)))
    return Math.floor(ceiling / grid.step) * grid.step
}

/** A row's count, kept within its ceiling and its step, so the send reads the picks as they are. */
export function withGridCount(
    picks: PowerChoicePicks,
    grid: WarbandGrid,
    row: number,
    count: number
): PowerChoicePicks {
    const ceiling = gridCeilingAt(grid, gridCounts(grid, picks), row)
    const kept = Math.floor(Math.max(0, Math.min(count, ceiling)) / grid.step) * grid.step
    return { ...picks, warbands: { ...picks.warbands, [gridKey(grid, row)]: kept } }
}

/** The power's least groups are counted, and an exact total is reached. */
function gridComplete(grid: WarbandGrid, counts: readonly number[]): boolean {
    const rows = counts.filter((count) => count > 0).length
    return rows >= grid.least && (!grid.exact || sum(counts) === grid.total)
}

function gridSent(grid: WarbandGrid, picks: PowerChoicePicks): PowerChoice[] {
    const counts = gridCounts(grid, picks)
    return grid.groups.flatMap((group, row) =>
        (counts[row] ?? 0) > 0
            ? [{ kind: PowerChoiceKind.Warbands, group: { ...group, count: counts[row] ?? 0 } }]
            : []
    )
}

/** The grid a spec is drawn in, if its picks are warbands. */
export function gridAt(grids: readonly WarbandGrid[], index: number): WarbandGrid | undefined {
    return grids.find((grid) => grid.specs.includes(index))
}

// No default where the player has a choice: a required spec with one legal value starts on it.
export function optionIndexOf(legal: LegalChoice, index: number, picks: PowerChoicePicks): number {
    const picked = picks.option[index]
    if (picked !== undefined) return picked
    return legal.spec.min > 0 && legal.options.length === 1 ? 0 : NO_OPTION
}

export function withOptionPick(
    picks: PowerChoicePicks,
    legal: LegalChoice,
    index: number,
    pick: number
): PowerChoicePicks {
    // R-10.8 — terms are written for one player.
    const terms =
        pick === optionIndexOf(legal, index, picks)
            ? picks.terms
            : Object.fromEntries(
                  Object.entries(picks.terms).filter(([key]) => Number(key) !== index)
              )
    return { ...picks, option: { ...picks.option, [index]: pick }, terms }
}

export function withCount(picks: PowerChoicePicks, index: number, count: number): PowerChoicePicks {
    return { ...picks, count: { ...picks.count, [index]: Math.max(0, count) } }
}

/**
 * A confirm waits until every spec has at least its least picks. A required single pick
 * counts the option the picker shows picked, as `powerChoicesFrom` sends it; an exchange also
 * waits for terms that move something, every picked site counted (R-10.8); a warband grid for
 * its least groups and, where the power names a total, that total.
 */
export function picksComplete(choices: readonly LegalChoice[], picks: PowerChoicePicks): boolean {
    const grids = warbandGrids(choices)
    return choices.every((legal, index) => {
        // Witch's Bargain: a player picked with nothing given is no entry yet.
        if (legal.spec.kind === PowerChoiceKind.Bargain) {
            return bargainChoices(picks.bargain[index] ?? []).length >= legal.spec.min
        }
        const grid = gridAt(grids, index)
        if (grid) return index !== grid.specs[0] || gridComplete(grid, gridCounts(grid, picks))
        if (allowsSeveral(legal)) {
            const picked = (picks.several[index] ?? []).filter(
                (option) => legal.options[option] !== undefined
            )
            return picked.length >= legal.spec.min
        }
        const option = legal.options[optionIndexOf(legal, index, picks)]
        if (option?.kind === PowerChoiceKind.Exchange) {
            return exchangeComplete(picks.terms[index] ?? noExchangePicks())
        }
        return (option === undefined ? 0 : 1) >= legal.spec.min
    })
}

export function powerChoicesFrom(
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks
): PowerChoice[] {
    const grids = warbandGrids(choices)
    const out: PowerChoice[] = []
    choices.forEach((legal, index) => {
        if (legal.spec.kind === PowerChoiceKind.Bargain) {
            out.push(...bargainChoices(picks.bargain[index] ?? []))
            return
        }
        const grid = gridAt(grids, index)
        if (grid) {
            if (index === grid.specs[0]) out.push(...gridSent(grid, picks))
            return
        }
        if (allowsSeveral(legal)) {
            for (const optionIndex of picks.several[index] ?? []) {
                const option = legal.options[optionIndex]
                if (option) out.push(option)
            }
            return
        }
        const option = legal.options[optionIndexOf(legal, index, picks)]
        if (!option) return
        if (option.kind === PowerChoiceKind.Exchange) {
            out.push({
                kind: PowerChoiceKind.Exchange,
                withPlayerId: option.withPlayerId,
                terms: picks.terms[index]?.terms ?? {}
            })
        } else if (option.kind === PowerChoiceKind.Count) {
            out.push({ kind: PowerChoiceKind.Count, n: picks.count[index] ?? 0 })
        } else {
            out.push(option)
        }
    })
    return out
}
