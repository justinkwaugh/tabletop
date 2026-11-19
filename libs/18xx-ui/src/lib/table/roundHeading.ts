import { assertExists, type GameState } from '@tabletop/common'
import {
    operatingRoundPart,
    type EighteenXXState,
    type OperatingRoundIdentity
} from '@tabletop/18xx'
import type { TitleRound } from '../session/titlePresentation.js'

export type RoundHeading = {
    abbreviation: string
    name: string
    number: string
    /** Operating rounds in the current set, given only when the set has more than one. */
    roundCount?: number
}

export const AuctionHeading: RoundHeading = { abbreviation: 'Auction', name: 'Auction', number: '' }

export function stockRoundHeading(number: number): RoundHeading {
    return { abbreviation: 'SR', name: 'Stock round', number: `${number}` }
}

/**
 * An operating round, or the title's round that follows it and shares its number; a round of an
 * endless set, with no set given, goes by its own number and, where given, the part of it
 * between the stock rounds that interrupt it, as 1880's OR 5.2.
 */
export function operatingRoundHeading(
    set: number | undefined,
    round: number,
    titleRound?: Pick<TitleRound, 'name' | 'abbreviation'>,
    part?: number
): RoundHeading {
    return {
        abbreviation: titleRound?.abbreviation ?? 'OR',
        name: titleRound?.name ?? 'Operating round',
        number:
            set !== undefined
                ? `${set}.${round}`
                : part !== undefined
                  ? `${round}.${part}`
                  : `${round}`
    }
}

/** The set a round is numbered within, none for an endless set's. */
export function operatingSetNumber(
    round: Pick<OperatingRoundIdentity, 'number' | 'endless'>
): number | undefined {
    return round.endless ? undefined : round.number
}

/** An operating round by its identity; an endless set's goes by the part of it under way. */
export function identifiedOperatingRoundHeading(
    round: OperatingRoundIdentity,
    part: number
): RoundHeading {
    return operatingRoundHeading(
        operatingSetNumber(round),
        round.roundNumber,
        undefined,
        round.endless ? part : undefined
    )
}

/** A title's round held after a stock round, which shares its number. */
export function titleStockRoundHeading(
    number: number,
    titleRound: Pick<TitleRound, 'name' | 'abbreviation'>
): RoundHeading {
    return { abbreviation: titleRound.abbreviation, name: titleRound.name, number: `${number}` }
}

/** Where play stands: the latest stock round, and the operating round of the latest set. */
export type RoundPosition = {
    stock: number
    /** Whether the operating set that follows the latest stock round is under way. */
    setUnderWay: boolean
    /** The set the round is numbered within, none for an endless set's. */
    set: number | undefined
    round: number
    /** The part of an endless set's round under way. */
    part: number | undefined
}

export function roundPosition(
    state: Pick<EighteenXXState, 'stockRound' | 'operatingSet'>
): RoundPosition {
    const set = state.operatingSet
    return {
        stock: state.stockRound.number,
        setUnderWay: !!set && !set.completed,
        set: set ? operatingSetNumber(set) : 1,
        round: set?.roundNumber ?? 1,
        part: set ? operatingRoundPart(set) : undefined
    }
}

/** A title's round: one following a stock round shares its number, others the operating round's. */
export function titleRoundHeading(
    titleRound: Pick<TitleRound, 'name' | 'abbreviation' | 'followsStockRound'>,
    position: RoundPosition
): RoundHeading {
    return titleRound.followsStockRound && !position.setUnderWay
        ? titleStockRoundHeading(position.stock, titleRound)
        : operatingRoundHeading(position.set, position.round, titleRound, position.part)
}

export function roundLabel(heading: RoundHeading): string {
    return heading.number ? `${heading.abbreviation} ${heading.number}` : heading.abbreviation
}

export function roundTitle(heading: RoundHeading): string {
    return heading.number ? `${heading.name} ${heading.number}` : heading.name
}

/** Whether an operating round is under way, rather than a stock round or a round of the title's own. */
export function operatingRoundInProgress<
    State extends GameState & Pick<EighteenXXState, 'stockRound' | 'operatingSet'>
>(state: State, titleRounds: readonly Pick<TitleRound<State>, 'inProgress'>[] = []): boolean {
    const set = state.operatingSet
    return (
        state.stockRound.completed &&
        !!set &&
        !set.completed &&
        !titleRounds.some((round) => round.inProgress(state))
    )
}

export function currentRoundHeading(
    state: EighteenXXState,
    titleRounds: readonly TitleRound[] = []
): RoundHeading {
    if (!state.stockRound.completed) return stockRoundHeading(state.stockRound.number)
    const titleRound = titleRounds.find((round) => round.inProgress(state))
    const position = roundPosition(state)
    const heading = titleRound
        ? titleRoundHeading(titleRound, position)
        : operatingRoundHeading(position.set, position.round, undefined, position.part)
    if (titleRound?.followsStockRound && !position.setUnderWay) return heading
    const set = state.operatingSet
    assertExists(set, 'An operating round belongs to a set')
    return set.roundCount !== undefined && set.roundCount > 1
        ? { ...heading, roundCount: set.roundCount }
        : heading
}
