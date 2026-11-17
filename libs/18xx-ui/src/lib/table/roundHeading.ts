import { assertExists, type GameState } from '@tabletop/common'
import { endlessOperatingSet, operatingRoundPart, type EighteenXXState } from '@tabletop/18xx'
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

/** A title's round held after a stock round, which shares its number. */
export function titleStockRoundHeading(
    number: number,
    titleRound: Pick<TitleRound, 'name' | 'abbreviation'>
): RoundHeading {
    return { abbreviation: titleRound.abbreviation, name: titleRound.name, number: `${number}` }
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
    const set = state.operatingSet
    if (titleRound?.followsStockRound && (!set || set.completed))
        return titleStockRoundHeading(state.stockRound.number, titleRound)
    assertExists(set, 'An operating round belongs to a set')
    if (endlessOperatingSet(set))
        return operatingRoundHeading(
            undefined,
            set.roundNumber,
            titleRound,
            operatingRoundPart(set)
        )
    const heading = operatingRoundHeading(set.number, set.roundNumber, titleRound)
    return set.roundCount !== undefined && set.roundCount > 1
        ? { ...heading, roundCount: set.roundCount }
        : heading
}
