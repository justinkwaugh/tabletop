import {
    isCompleteStockRound,
    isFinishOperatingTurn,
    isStartOperatingRound,
    isStartStockRound,
    recordedRoundEnd,
    type EighteenXXState,
    type OperatingRoundIdentity,
    type PlayerNetWorth,
    type RoundEnd
} from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'
import type { TitleRound } from '../session/titlePresentation.js'
import {
    AuctionHeading,
    operatingRoundHeading,
    roundLabel,
    roundTitle,
    stockRoundHeading,
    titleStockRoundHeading,
    type RoundHeading
} from './roundHeading.js'

export type WealthPoint = {
    id: string
    label: string
    title: string
    wealth: Readonly<PlayerNetWorth>
}

type WealthTitleRound = Pick<
    TitleRound,
    'name' | 'abbreviation' | 'starts' | 'ends' | 'followsStockRound'
>
export type WealthHistoryTitle = {
    startingCash: number
    openingRound?: Pick<TitleRound, 'name' | 'abbreviation'>
    titleRounds?: readonly WealthTitleRound[]
}

/**
 * Every player's wealth at the start of the game and at the end of each round, oldest first,
 * from what the round-ending Actions record. The final wealth ends the round the game ended in.
 *
 * Games stored before rounds recorded their ends lack their opening and title-round points, and
 * take a stock round's end from the next operating round's start, which includes that round's
 * private income.
 */
export function wealthHistory(
    actions: readonly GameAction[],
    state: Pick<EighteenXXState, 'players' | 'finalWealth'>,
    title: WealthHistoryTitle
): WealthPoint[] {
    const titleRounds = title.titleRounds ?? []
    const opening: RoundHeading = title.openingRound
        ? { ...title.openingRound, number: '' }
        : AuctionHeading
    const points: WealthPoint[] = [
        {
            id: 'start',
            label: 'Start',
            title: 'Start',
            wealth: Object.fromEntries(
                state.players.map(({ playerId }) => [playerId, title.startingCash])
            )
        }
    ]
    // A round that ends again, such as one a merger gives another company to operate, keeps its
    // place with its later end.
    function record(heading: RoundHeading, wealth: PlayerNetWorth) {
        const label = roundLabel(heading)
        const point = { id: label, label, title: roundTitle(heading), wealth }
        const index = points.findIndex((existing) => existing.id === label)
        if (index >= 0) points[index] = point
        else points.push(point)
    }
    let current = opening
    let stockRound = 1
    let operatingRound: OperatingRoundIdentity = { number: 1, roundNumber: 1 }
    let setUnderWay = false
    // Operating rounds held before the first stock round, as in 1846's two-player opening,
    // belong to the opening.
    let firstStockRoundEnded = false
    let unrecordedStockRound: number | undefined
    function titleRoundHeading(round: WealthTitleRound): RoundHeading {
        return round.followsStockRound && !setUnderWay
            ? titleStockRoundHeading(stockRound, round)
            : operatingRoundHeading(operatingRound.number, operatingRound.roundNumber, round)
    }
    for (const action of actions) {
        if (isStartStockRound(action)) {
            stockRound++
            setUnderWay = false
            current = stockRoundHeading(stockRound)
        }
        const startedRound = titleRounds.find((round) => round.starts(action))
        if (startedRound) current = titleRoundHeading(startedRound)
        const snapshot = isStartOperatingRound(action)
            ? action.metadata?.snapshot
            : isFinishOperatingTurn(action)
              ? action.metadata
              : undefined
        if (isStartOperatingRound(action) && snapshot) {
            if (unrecordedStockRound !== undefined)
                record(stockRoundHeading(unrecordedStockRound), snapshot.playerNetWorth)
            unrecordedStockRound = undefined
            operatingRound = snapshot
            setUnderWay = true
            current = operatingRoundHeading(snapshot.number, snapshot.roundNumber)
        }
        const end: RoundEnd | undefined =
            recordedRoundEnd(action) ??
            (snapshot?.complete
                ? { round: 'operating', playerNetWorth: snapshot.playerNetWorth }
                : undefined)
        if (isCompleteStockRound(action)) {
            firstStockRoundEnded = true
            if (!end) unrecordedStockRound = stockRound
        }
        if (!end) continue
        switch (end.round) {
            case 'opening':
                record(opening, end.playerNetWorth)
                current = stockRoundHeading(1)
                break
            case 'stock':
                record(stockRoundHeading(stockRound), end.playerNetWorth)
                break
            case 'operating':
                if (firstStockRoundEnded)
                    record(
                        operatingRoundHeading(operatingRound.number, operatingRound.roundNumber),
                        end.playerNetWorth
                    )
                break
            case 'title': {
                const round = titleRounds.find((candidate) => candidate.ends(action))
                assertExists(round, 'A title round’s end belongs to one of the title’s rounds')
                record(titleRoundHeading(round), end.playerNetWorth)
                break
            }
        }
    }
    if (state.finalWealth)
        record(
            current,
            Object.fromEntries(state.finalWealth.map(({ playerId, total }) => [playerId, total]))
        )
    return points
}
