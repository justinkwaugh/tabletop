import {
    FAVOR_BANK_ORDER,
    PowerChoiceKind,
    usableFavor,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice,
    type Suit,
    type WarbandGroup
} from '@tabletop/oath'
import { bargainChoices, type BargainPick } from './bargainPicks.js'
import {
    exchangeComplete,
    exchangePicked,
    noExchangePicks,
    type ExchangePicks
} from './exchangeTerms.js'
import { isPowerMoves, type MovePick } from './powerMoves.js'

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

export const NO_OPTION = -1

/**
 * Anything picked at all: Undo past the last pick leaves the picks. A pick taken back keeps its
 * entry with nothing in it, which is no pick: a row of pieces or a count at 0, an option at none,
 * an emptied list or bargain, or terms that move nothing.
 */
export function hasPicks(picks: PowerChoicePicks): boolean {
    return (
        picks.moves.length > 0 ||
        Object.values(picks.warbands).some((count) => count > 0) ||
        Object.values(picks.count).some((count) => count > 0) ||
        Object.values(picks.option).some((option) => option !== NO_OPTION) ||
        Object.values(picks.several).some((picked) => picked.length > 0) ||
        Object.values(picks.bargain).some((picked) => picked.length > 0) ||
        Object.values(picks.terms).some(exchangePicked)
    )
}

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
        // A place picked whole is one tap per place (Wrestlers), not a row of pieces.
        if (legal.spec.kind !== PowerChoiceKind.Warbands || legal.spec.byPlace) {
            index += 1
            continue
        }
        const specs = [index]
        if (!allowsSeveral(legal)) {
            while (
                specs.length + index < choices.length &&
                choices[index + specs.length].spec.kind === PowerChoiceKind.Warbands &&
                !allowsSeveral(choices[index + specs.length]) &&
                !choices[index + specs.length].spec.byPlace &&
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

/**
 * The first branch of a card's "or" picked (Forgotten Vault's place, Mountain Giant's ±1,
 * Bracken's top): it sends no yes. R-7.1.3 — neither branch is a default, so none starts picked.
 */
export const FIRST_BRANCH = -2

/** A card's "or": two answers, the yes its second branch. */
export function isOr(legal: LegalChoice | undefined): boolean {
    return legal?.spec.kind === PowerChoiceKind.Yes && legal.spec.or === true
}

/** A card's "may": an optional yes that is no branch of an "or", drawn as a toggle row, off. */
export function isMay(legal: LegalChoice | undefined): boolean {
    return legal?.spec.kind === PowerChoiceKind.Yes && legal.spec.min === 0 && !isOr(legal)
}

/**
 * A choice the card may skip, with nothing offered now, has nothing to pick and draws no row: a
 * "may" the card does not offer, or an optional pick with an empty offer (Ivory Eye's facedown
 * relic when none is at a site) while another of the power's choices offers something. A choice
 * the power needs keeps its row, which says none is legal; an "or" always draws its answers.
 */
export function offersNothing(choices: readonly LegalChoice[], index: number): boolean {
    const legal = choices[index]
    if (!legal || legal.options.length > 0 || legal.spec.min > 0 || isOr(legal)) return false
    return isMay(legal) || choices.some((other) => other.options.length > 0)
}

/** The "may" a later spec is part of (Royal Ambitions' relic is taken only with its yes). */
export function mayOf(choices: readonly LegalChoice[], index: number): number | undefined {
    for (let at = index - 1; at >= 0; at -= 1) if (isMay(choices[at])) return at
    return undefined
}

/** A choice with no option offered now; an "or" always offers its answers. */
function offersNoOption(legal: LegalChoice): boolean {
    return legal.options.length === 0 && !isOr(legal)
}

/**
 * A power whose picks can never be made now, so its list leaves it out: a choice it needs offers
 * nothing (Captains with no site that has a defender), or, for a power that needs a move, no From
 * is offered (Messenger with no warband it can move). Warning Signals' moves are all a "may", so
 * with nothing to move it is used moving nothing. A choice asked only while it has an option, or
 * only with a "may" on, is not needed.
 */
export function picksCannotBeMade(choices: readonly LegalChoice[]): boolean {
    if (isPowerMoves(choices)) {
        const first = choices[0]
        return first !== undefined && offersNoOption(first) && first.spec.min > 0
    }
    return choices.some(
        (legal, index) =>
            offersNoOption(legal) &&
            legal.spec.min > 0 &&
            !legal.spec.askedIfAny &&
            mayOf(choices, index) === undefined
    )
}

/**
 * A power that asks for choices and offers nothing in any of them (Ivory Eye with nothing
 * facedown): the one use left is with no picks, which the engine judges.
 */
export function offersNoPick(choices: readonly LegalChoice[]): boolean {
    return choices.length > 0 && choices.every(offersNoOption)
}

function mayOn(choices: readonly LegalChoice[], index: number, picks: PowerChoicePicks): boolean {
    const legal = choices[index]
    return legal !== undefined && legal.options[optionIndexOf(legal, index, picks)] !== undefined
}

/** A spec drawn and sent: always, unless it is part of a "may" left off. */
export function asked(
    choices: readonly LegalChoice[],
    index: number,
    picks: PowerChoicePicks
): boolean {
    const may = mayOf(choices, index)
    return may === undefined || mayOn(choices, may, picks)
}

/** The "may" on or off; off takes back what only its yes asked for. */
export function withMay(
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks,
    index: number,
    on: boolean
): PowerChoicePicks {
    const option = Object.fromEntries(
        Object.entries(picks.option).filter(([key]) => {
            const at = Number(key)
            return at !== index && (on || mayOf(choices, at) !== index)
        })
    )
    return { ...picks, option: on ? { ...option, [index]: 0 } : option }
}

/** One of an "or"'s two answers picked; a picked answer stays picked, as the pick is required. */
export function withBranch(
    picks: PowerChoicePicks,
    index: number,
    second: boolean
): PowerChoicePicks {
    return { ...picks, option: { ...picks.option, [index]: second ? 0 : FIRST_BRANCH } }
}

/**
 * R-7.1.3 — a run of favor bank picks that repeat one pick (Alchemist's four, Memory of Nature's
 * X, Salad Days' three). A counted run names one favor per spec, as many from a bank as it
 * holds, and comes to `total` (the engine's `favorTotal`); a distinct run names `total` banks,
 * each once. Either is sent as its specs in the board's bank order, the first to the first spec.
 */
export type BankRun = { specs: number[]; distinct: boolean; total: number }

function sameRun(one: LegalChoice, other: LegalChoice | undefined): boolean {
    return (
        other?.spec.kind === PowerChoiceKind.FavorBank &&
        one.spec.what === other.spec.what &&
        one.spec.min === other.spec.min &&
        JSON.stringify(one.options) === JSON.stringify(other.options)
    )
}

export function bankRuns(choices: readonly LegalChoice[]): BankRun[] {
    const runs: BankRun[] = []
    let index = 0
    while (index < choices.length) {
        const legal = choices[index]
        let length = 1
        while (
            legal?.spec.kind === PowerChoiceKind.FavorBank &&
            sameRun(legal, choices[index + length])
        ) {
            length += 1
        }
        const specs = Array.from({ length }, (_, at) => index + at)
        if (legal && length > 1 && legal.spec.min > 0) {
            runs.push({ specs, distinct: true, total: length })
        } else if (legal && length > 1 && legal.total !== undefined) {
            runs.push({ specs, distinct: false, total: Math.min(legal.total, length) })
        }
        index += length
    }
    return runs
}

export function runAt(runs: readonly BankRun[], index: number): BankRun | undefined {
    return runs.find((run) => run.specs.includes(index))
}

/** The banks a run names, one entry per favor, in spec order. */
export function runSuits(
    run: BankRun,
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks
): Suit[] {
    return run.specs.flatMap((spec) => {
        const legal = choices[spec]
        const option = legal?.options[optionIndexOf(legal, spec, picks)]
        return option?.kind === PowerChoiceKind.FavorBank ? [option.suit] : []
    })
}

/** The run's specs given these banks, sorted to the board's order; the rest unpicked. */
function withRunSuits(
    run: BankRun,
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks,
    suits: readonly Suit[]
): PowerChoicePicks {
    const ordered = FAVOR_BANK_ORDER.flatMap((suit) => suits.filter((named) => named === suit))
    const option = Object.fromEntries(
        Object.entries(picks.option).filter(([key]) => !run.specs.includes(Number(key)))
    )
    run.specs.forEach((spec, at) => {
        const suit = ordered[at]
        const pick = (choices[spec]?.options ?? []).findIndex(
            (choice) => choice.kind === PowerChoiceKind.FavorBank && choice.suit === suit
        )
        if (suit !== undefined && pick >= 0) option[spec] = pick
    })
    return { ...picks, option }
}

/** The most a bank's row may be set to with the other rows as they are. */
export function runCeilingAt(
    run: BankRun,
    suits: readonly Suit[],
    suit: Suit,
    held: number
): number {
    const others = suits.filter((named) => named !== suit).length
    return Math.max(0, Math.min(held, run.total - others))
}

/** A counted run's bank set to `count` favor, kept within what it holds and what the total leaves. */
export function withRunCount(
    run: BankRun,
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks,
    suit: Suit,
    count: number,
    held: number
): PowerChoicePicks {
    const suits = runSuits(run, choices, picks)
    const kept = Math.max(0, Math.min(count, runCeilingAt(run, suits, suit, held)))
    const others = suits.filter((named) => named !== suit)
    return withRunSuits(run, choices, picks, [...others, ...Array<Suit>(kept).fill(suit)])
}

/** A distinct run's bank tapped: in, while the run has room; out, when it was in. */
export function withRunToggled(
    run: BankRun,
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks,
    suit: Suit
): PowerChoicePicks {
    const suits = runSuits(run, choices, picks)
    if (suits.includes(suit)) {
        return withRunSuits(
            run,
            choices,
            picks,
            suits.filter((named) => named !== suit)
        )
    }
    return suits.length < run.total ? withRunSuits(run, choices, picks, [...suits, suit]) : picks
}

/**
 * R-7.1.3 — the banks a distinct run may still name: while it has room, every offered bank that
 * holds favor, and an empty one only while the room left keeps a place for each bank that holds
 * favor and is not yet named. So the empty banks fill only what the banks with favor leave, and
 * with fewer than three holding favor Salad Days names every one that does (revision 8).
 */
export function openRunBanks(
    run: BankRun,
    offered: readonly Suit[],
    named: readonly Suit[],
    favor: Readonly<Record<Suit, number>>
): Suit[] {
    const room = run.total - named.length
    if (room <= 0) return []
    const holdingLeft = offered.filter((suit) => favor[suit] > 0 && !named.includes(suit)).length
    return offered.filter(
        (suit) => !named.includes(suit) && (favor[suit] > 0 || holdingLeft < room)
    )
}

// No default where the player has a choice: a required spec with one legal value starts on it,
// and so does an "or" whose second branch is not offered.
export function optionIndexOf(legal: LegalChoice, index: number, picks: PowerChoicePicks): number {
    const picked = picks.option[index]
    if (picked !== undefined) return picked
    if (isOr(legal) && legal.options.length === 0) return FIRST_BRANCH
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
 * its least groups and, where the power names a total, that total; a counted bank run for its
 * total; an "or" for one of its answers; and a "may" that is on, for what its yes asks.
 */
export function picksComplete(choices: readonly LegalChoice[], picks: PowerChoicePicks): boolean {
    const grids = warbandGrids(choices)
    const runs = bankRuns(choices)
    return choices.every((legal, index) => {
        // Witch's Bargain: a player picked with nothing given is no entry yet.
        if (legal.spec.kind === PowerChoiceKind.Bargain) {
            return bargainChoices(picks.bargain[index] ?? []).length >= legal.spec.min
        }
        const grid = gridAt(grids, index)
        if (grid) return index !== grid.specs[0] || gridComplete(grid, gridCounts(grid, picks))
        const run = runAt(runs, index)
        if (run && !run.distinct) {
            return index !== run.specs[0] || runSuits(run, choices, picks).length === run.total
        }
        // An "or" waits for one of its answers; a may's own pick waits only while the may is on.
        if (isOr(legal)) return optionIndexOf(legal, index, picks) !== NO_OPTION
        if (mayOf(choices, index) !== undefined) {
            return (
                !asked(choices, index, picks) ||
                legal.options.length === 0 ||
                legal.options[optionIndexOf(legal, index, picks)] !== undefined
            )
        }
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
        if (!asked(choices, index, picks)) return
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
