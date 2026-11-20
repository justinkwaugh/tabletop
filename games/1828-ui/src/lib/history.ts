import {
    CobourgRailwayId,
    PeterboroughLocationId,
    isChooseCobourgRun,
    isExchangeMohawkForDirectorship,
    isExchangeMohawkForDirectorshipOutOfTurn,
    isRunCobourg,
    MhId
} from '@tabletop/1828'
import { isBuyAccessRight, type CashPayment } from '@tabletop/18xx'
import {
    counted,
    joinDetails,
    ownerName,
    type HistoryDescription,
    type HistoryMapPlacement,
    type HistoryNames,
    type MoneyFormat,
    type TitleHistoryNames
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'
import {
    isAnswerMerger,
    isBlockMergerStation,
    isChooseSetAsideShare,
    isChooseTrainShell,
    isCloseCobourg,
    isDecideMergerShare,
    isFormSystem,
    isMoveShellTrain,
    isPlaceShellTrains,
    isProposeMerger,
    isRemoveUnparredCompanies,
    isReplaceCobourgStation,
    isSwapShellTrains
} from '@tabletop/1828'

export type HistoryNames1828 = HistoryNames & Pick<TitleHistoryNames, 'place'>

export function describe1828MapPlacement(action: GameAction): HistoryMapPlacement | undefined {
    if (isReplaceCobourgStation(action) && action.replace)
        return {
            kind: 'station',
            companyId: action.companyId,
            locationIds: [PeterboroughLocationId]
        }
    return undefined
}

function paymentWords(payments: readonly CashPayment[], names: HistoryNames, money: MoneyFormat) {
    return payments.map((payment) =>
        payment.from.kind === 'bank'
            ? `${ownerName(payment.to, names)} received ${money(payment.amount)}`
            : `${ownerName(payment.from, names)} paid ${money(payment.amount)}`
    )
}

export function describe1828Action(
    action: GameAction,
    names: HistoryNames1828,
    money: MoneyFormat,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    const { companyName, playerName, place } = names
    if (isBuyAccessRight(action)) return { ...shared(), text: 'Bought a coal marker' }
    if (isProposeMerger(action))
        return {
            text: `proposed merging ${companyName(action.absorbedId)} into ${companyName(action.survivorId)}`
        }
    if (isAnswerMerger(action))
        return { text: action.accept ? 'agreed to the merger' : 'refused the merger' }
    if (isBlockMergerStation(action))
        return { text: 'chose the station that becomes a blocking station' }
    if (isChooseSetAsideShare(action))
        return { text: `set aside a single ${companyName(action.companyId)} share` }
    if (isChooseTrainShell(action))
        return {
            text: `chose the ${companyName(action.shellCompanyId)} shell for the next train`
        }
    if (isDecideMergerShare(action))
        return {
            text: action.tradeUp
                ? 'traded up their single share to a system share'
                : 'sold their single share to the bank pool'
        }
    if (isFormSystem(action)) {
        const outcome = action.metadata
        if (!outcome) return { text: 'The merger concluded', omitActor: true }
        const pair = `${companyName(outcome.survivorId)} and ${companyName(outcome.absorbedId)}`
        if (outcome.failure)
            return {
                text: `The merger of ${pair} failed`,
                detail: outcome.failure,
                omitActor: true,
                important: true
            }
        return {
            text: `${pair} formed a system as ${companyName(outcome.survivorId)}`,
            omitActor: true,
            companyToken: outcome.survivorId,
            milestone: true,
            detailLines: [
                ...(outcome.directorId ? [`${playerName(outcome.directorId)} directs`] : []),
                ...Object.entries(outcome.shares)
                    .filter(([, shares]) => shares > 0)
                    .map(
                        ([playerId, shares]) =>
                            `${playerName(playerId)} ${counted(shares, 'share')}`
                    ),
                ...(outcome.poolShares
                    ? [`Bank pool ${counted(outcome.poolShares, 'share')}`]
                    : []),
                ...(outcome.ipoShares ? [`IPO ${counted(outcome.ipoShares, 'share')}`] : []),
                ...paymentWords(outcome.payments, names, money),
                ...(outcome.blockedStationIds.length
                    ? [counted(outcome.blockedStationIds.length, 'blocking station')]
                    : []),
                ...(outcome.floated ? [] : ['Not yet floated'])
            ]
        }
    }
    if (isSwapShellTrains(action))
        return { text: `${companyName(action.companyId)} swapped trains between its shells` }
    if (isMoveShellTrain(action))
        return { text: `${companyName(action.companyId)} moved a train between its shells` }
    if (isPlaceShellTrains(action)) {
        const [first, second] = action.metadata?.trainIds ?? [[], []]
        return {
            text: `${companyName(action.companyId)} placed ${counted(first.length + second.length, 'new train')} in its shells`,
            detail: joinDetails(
                first.length ? `${first.length} in the first` : undefined,
                second.length ? `${second.length} in the second` : undefined
            ),
            omitActor: true,
            routine: true,
            consequence: true
        }
    }
    if (isExchangeMohawkForDirectorship(action) || isExchangeMohawkForDirectorshipOutOfTurn(action))
        return {
            text: `Exchanged ${names.companyName(MhId)} for half the ${names.companyName(action.companyId)} director’s certificate`,
            value: money(action.expectedPrice),
            detail: `Par ${money(action.expectedPrice)}`,
            important: true
        }
    if (isRunCobourg(action) && !action.metadata?.revenue)
        return {
            text: 'The C&P ran nothing',
            omitActor: true,
            companyToken: CobourgRailwayId,
            routine: true
        }
    if ((isChooseCobourgRun(action) || isRunCobourg(action)) && action.metadata) {
        const run = action.metadata
        return {
            text: `The C&P ran ${run.stops.map((stop) => place(stop.locationId)).join('–')}`,
            value: money(run.revenue),
            detail: joinDetails(...paymentWords(run.payments, names, money)),
            omitActor: isRunCobourg(action),
            companyToken: CobourgRailwayId
        }
    }
    if (isReplaceCobourgStation(action))
        return {
            text: action.replace
                ? `${companyName(action.companyId)} replaced the C&P station in ${place(PeterboroughLocationId)}`
                : `${companyName(action.companyId)} left the C&P station in ${place(PeterboroughLocationId)} as a blocking station`
        }
    if (isCloseCobourg(action))
        return {
            text: 'The C&P railway closed',
            detail: joinDetails(
                ...(action.metadata?.payments ?? []).map(
                    (payment) => `${money(payment.amount)} treasury discarded`
                ),
                'Its station blocks Peterborough'
            ),
            omitActor: true,
            companyToken: CobourgRailwayId,
            important: true
        }
    if (isRemoveUnparredCompanies(action)) {
        const removed = action.metadata?.companyIds ?? []
        return {
            text: removed.length
                ? `${removed.map((id) => companyName(id)).join(', ')} left the game unparred`
                : 'Every company was parred',
            detail: action.metadata?.blockingStationIds.length
                ? `${counted(action.metadata.blockingStationIds.length, 'blocking station')} at their homes`
                : undefined,
            omitActor: true,
            important: removed.length > 0
        }
    }
    return undefined
}
