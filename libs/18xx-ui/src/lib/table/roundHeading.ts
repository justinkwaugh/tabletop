import { assertExists } from '@tabletop/common'
import type { EighteenXXState } from '@tabletop/18xx'
import type { TitleRound } from '../session/titlePresentation.js'

export type RoundHeading = { abbreviation: string; name: string; number: string }

export const AuctionHeading: RoundHeading = { abbreviation: 'Auction', name: 'Auction', number: '' }

export function stockRoundHeading(number: number): RoundHeading {
    return { abbreviation: 'SR', name: 'Stock round', number: `${number}` }
}

/** An operating round, or the title's round that follows it and shares its number. */
export function operatingRoundHeading(
    set: number,
    round: number,
    titleRound?: TitleRound
): RoundHeading {
    return {
        abbreviation: titleRound?.abbreviation ?? 'OR',
        name: titleRound?.name ?? 'Operating round',
        number: `${set}.${round}`
    }
}

/** A title's round held after a stock round, which shares its number. */
export function titleStockRoundHeading(number: number, titleRound: TitleRound): RoundHeading {
    return { abbreviation: titleRound.abbreviation, name: titleRound.name, number: `${number}` }
}

export function roundLabel(heading: RoundHeading): string {
    return heading.number ? `${heading.abbreviation} ${heading.number}` : heading.abbreviation
}

export function roundTitle(heading: RoundHeading): string {
    return heading.number ? `${heading.name} ${heading.number}` : heading.name
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
    return operatingRoundHeading(set.number, set.roundNumber, titleRound)
}
