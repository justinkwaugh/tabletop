import {
    PowerChoiceKind,
    legalChoices,
    type CardPower,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice,
    type WarbandGroup
} from '@tabletop/oath'

/** Where a move's warbands come from: a place and an owner, as the engine's options name them. */
export type MoveFrom = Pick<WarbandGroup, 'at' | 'owner'>
/** Where they go: the mover's board, or a site. */
export type MoveTo = { kind: 'board' } | { kind: 'site'; siteId: string }

/** One move's picks, as tapped: a pick the panel makes because it has one option is not kept. */
export type MovePick = { from?: MoveFrom; count?: number; to?: MoveTo }

export type WholeMove = { from: MoveFrom; count: number; to: MoveTo }

/** The move being picked: its options, read on the state the whole moves before it leave. */
export interface OpenMove {
    /** Each place and owner with warbands free to move, and how many. */
    sources: WarbandGroup[]
    from?: MoveFrom
    /** How many are free at the picked place. */
    free: number
    count?: number
    destinations: MoveTo[]
    to?: MoveTo
}

export interface PowerMoves {
    whole: WholeMove[]
    /** None once the power's moves are all used. */
    open?: OpenMove
}

/**
 * An effect whose choices are moves (Messenger): warbands and a site in turn, each read on the
 * state the choices before it leave. The panel shows one move at a time.
 */
export function isPowerMoves(choices: readonly LegalChoice[]): boolean {
    return (
        choices.length > 0 &&
        choices.length % 2 === 0 &&
        choices.every(
            (legal, i) =>
                legal.spec.sequential === true &&
                legal.spec.kind === (i % 2 === 0 ? PowerChoiceKind.Warbands : PowerChoiceKind.Site)
        )
    )
}

export function sameFrom(a: MoveFrom, b: MoveFrom): boolean {
    return a.owner === b.owner && sameAt(a.at, b.at)
}

function sameAt(a: MoveFrom['at'], b: MoveFrom['at']): boolean {
    return a.kind === 'board'
        ? b.kind === 'board' && a.playerId === b.playerId
        : b.kind === 'site' && a.siteId === b.siteId
}

export function sameTo(a: MoveTo, b: MoveTo): boolean {
    return a.kind === 'board' ? b.kind === 'board' : b.kind === 'site' && a.siteId === b.siteId
}

/** The choices a list of whole moves sends: the warbands, then the site unless they go to the board. */
export function moveChoices(moves: readonly WholeMove[]): PowerChoice[] {
    return moves.flatMap(({ from, count, to }): PowerChoice[] => {
        const warbands: PowerChoice = { kind: PowerChoiceKind.Warbands, group: { ...from, count } }
        if (to.kind === 'board') return [warbands]
        return [warbands, { kind: PowerChoiceKind.Site, siteId: to.siteId }]
    })
}

/**
 * R-6.5 with the card's text — from the board the warbands go to a site the mover rules; from a
 * site, to the board or another site they rule.
 */
function destinationsOf(from: MoveFrom, sites: readonly PowerChoice[]): MoveTo[] {
    const ruled = sites.flatMap((option): MoveTo[] =>
        option.kind === PowerChoiceKind.Site &&
        !(from.at.kind === 'site' && from.at.siteId === option.siteId)
            ? [{ kind: 'site', siteId: option.siteId }]
            : []
    )
    return from.at.kind === 'board' ? ruled : [{ kind: 'board' }, ...ruled]
}

/**
 * The moves as the panel shows them: each read with the engine's options on the state the moves
 * before it leave. A pick with one option is made (the first move's From too, which the power
 * needs); a later move's From starts empty, as a further move may be made or not.
 */
export function powerMoves(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    picks: readonly MovePick[]
): PowerMoves {
    const whole: WholeMove[] = []
    for (;;) {
        const legal = legalChoices(state, playerId, power, moveChoices(whole))
        const warbands = legal[whole.length * 2]
        const sites = legal[whole.length * 2 + 1]
        if (!warbands || !sites) return { whole }
        const open = openMove(warbands, sites, picks[whole.length] ?? {})
        const { from, count, to } = open
        if (!from || count === undefined || !to) return { whole, open }
        whole.push({ from, count, to })
    }
}

function openMove(warbands: LegalChoice, sites: LegalChoice, pick: MovePick): OpenMove {
    const sources = warbands.options.flatMap((option) =>
        option.kind === PowerChoiceKind.Warbands ? [option.group] : []
    )
    const wanted = pick.from
    const picked = wanted ? sources.find((group) => sameFrom(group, wanted)) : undefined
    const source = picked ?? (warbands.spec.min > 0 ? only(sources) : undefined)
    if (!source) return { sources, free: 0, destinations: [] }
    const from = { at: source.at, owner: source.owner }
    const free = source.count
    const count =
        pick.count !== undefined && pick.count >= 1 && pick.count <= free
            ? pick.count
            : free === 1
              ? 1
              : undefined
    const destinations = destinationsOf(from, sites.options)
    const chosen = pick.to
    const to =
        count === undefined
            ? undefined
            : ((chosen ? destinations.find((d) => sameTo(d, chosen)) : undefined) ??
              only(destinations))
    return { sources, from, free, count, destinations, to }
}

function only<T>(options: readonly T[]): T | undefined {
    return options.length === 1 ? options[0] : undefined
}

/** "Use" waits for a whole move and none half-built. */
export function powerMovesComplete(moves: PowerMoves): boolean {
    return moves.whole.length > 0 && moves.open?.from === undefined
}

/** Undo takes back the last pick (To, then How many, then From), so a whole move goes last. */
export function withoutLastPick(picks: readonly MovePick[]): MovePick[] {
    const last = picks.at(-1)
    if (!last) return []
    const rest = picks.slice(0, -1)
    if (last.to) return withoutEmptyTail([...rest, picked(last.from, last.count)])
    if (last.count !== undefined) return withoutEmptyTail([...rest, picked(last.from)])
    return withoutEmptyTail(rest)
}

/** A tap on a From: picks it, or clears the move when it is the one picked. */
export function withFrom(picks: readonly MovePick[], index: number, from: MoveFrom): MovePick[] {
    const current = picks[index]?.from
    return withoutEmptyTail([
        ...picksBefore(picks, index),
        ...(current && sameFrom(current, from) ? [] : [{ from }])
    ])
}

/** A tap on the Nth warband sets N; a tap on the current count clears it. */
export function withCount(
    picks: readonly MovePick[],
    index: number,
    from: MoveFrom,
    shown: number | undefined,
    tapped: number
): MovePick[] {
    const pick = picks[index] ?? { from }
    return [
        ...picksBefore(picks, index),
        picked(pick.from ?? from, tapped === shown ? undefined : tapped)
    ]
}

/**
 * A tap on a To. The From is kept though the panel may have made it (it anchors the To); a count
 * the panel made is not, so Undo takes the To and then the From.
 */
export function withTo(
    picks: readonly MovePick[],
    index: number,
    from: MoveFrom,
    to: MoveTo
): MovePick[] {
    const pick = picks[index] ?? { from }
    return [...picksBefore(picks, index), { ...picked(pick.from ?? from, pick.count), to }]
}

/** The picks of the moves before `index`, one per move: a move the panel made from no pick keeps its place. */
function picksBefore(picks: readonly MovePick[], index: number): MovePick[] {
    return Array.from({ length: index }, (_, i) => picks[i] ?? {})
}

function picked(from: MoveFrom | undefined, count?: number): MovePick {
    return { ...(from ? { from } : {}), ...(count !== undefined ? { count } : {}) }
}

/** Empty picks at the end say nothing; dropped, so Undo never takes back nothing. */
function withoutEmptyTail(picks: MovePick[]): MovePick[] {
    let end = picks.length
    while (end > 0 && isEmptyPick(picks[end - 1])) end--
    return picks.slice(0, end)
}

function isEmptyPick(pick: MovePick | undefined): boolean {
    return !pick?.from && pick?.count === undefined && !pick?.to
}
