import { ActionSource, type GameAction } from '@tabletop/common'
import {
    isFinishTrack,
    isFinishStations,
    isPayInterest,
    isRunTrains,
    type EighteenXXState
} from '@tabletop/18xx'
import type { MoneyFormat } from '../presentation/money.js'
export function operatingStepStatuses(
    gameState: EighteenXXState,
    actions: readonly GameAction[],
    money: MoneyFormat
) {
    const boundary = actions.findLastIndex(
        (action) =>
            action.type === 'StartOperatingTurn' ||
            action.type === 'FinishOperatingTurn' ||
            action.type === 'StartOperatingRound'
    )
    const current = actions.slice(boundary + 1)
    const track = current.findLast(isFinishTrack)
    const station = current.findLast(isFinishStations)
    const run = current.findLast(isRunTrains)
    const interest = current.findLast(isPayInterest)
    const distribution = gameState.earningsDistribution
    const purchased = gameState.trainPurchaseStep?.purchasedTrainIds.length ?? 0
    return {
        track: gameState.trackStep?.lays.length
            ? `${gameState.trackStep.lays.length} laid`
            : gameState.trackStep?.completed && track?.companyId === gameState.trackStep.companyId
              ? track.source === ActionSource.System
                  ? 'Not available'
                  : 'Skipped'
              : undefined,
        station: gameState.stationStep?.placedStationIds.length
            ? 'Placed'
            : gameState.stationStep?.completed &&
                station?.companyId === gameState.stationStep.companyId
              ? station.source === ActionSource.System
                  ? 'Not available'
                  : 'Skipped'
              : undefined,
        run: gameState.routeStep?.result?.routes.length
            ? `Ran for ${money(gameState.routeStep.result.revenue)}`
            : gameState.routeStep?.result && run?.companyId === gameState.routeStep.companyId
              ? run.source === ActionSource.System
                  ? 'Not available'
                  : 'Skipped'
              : undefined,
        payout: distribution
            ? distribution.choice === 'pay'
                ? 'Paid out'
                : distribution.choice === 'half-pay'
                  ? 'Half-paid'
                  : 'Withheld'
            : undefined,
        trains: purchased ? `${purchased} bought` : undefined,
        loans: interest?.metadata
            ? interest.metadata.default
                ? 'Defaulted'
                : `Paid ${money(interest.metadata.interest)}`
            : undefined
    }
}
export type OperatingStepStatuses = ReturnType<typeof operatingStepStatuses>
