import {
    isAnswerMerger,
    isApplyPhaseEffects,
    isBuyMergerShares,
    isChooseMergerStations,
    isDecideTrainlessMajor,
    isDiscardMergerTrain,
    isEndMergerRound,
    isNationaliseCompany,
    isPassMerger,
    isPlaceStateStation,
    isProposeMerger,
    isSettleLoans,
    isStartMergerRound
} from '@tabletop/1861'
import type { Nationalisation } from '@tabletop/18xx'
import {
    joinDetails,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/** What a nationalisation paid and gave the RSR (§11). */
function nationalisationDetail(
    details: Nationalisation,
    names: HistoryNames,
    money: MoneyFormat
): string | undefined {
    const payouts = details.payouts.map((payout) =>
        payout.to.kind === 'player'
            ? `${names.playerName(payout.to.playerId)} ${money(payout.amount)}`
            : undefined
    )
    const assets = details.assets
    return joinDetails(
        `${money(details.price)} a share`,
        ...payouts,
        details.writtenOff ? `${plural(details.writtenOff, 'loan')} written off` : undefined,
        assets?.trainIds.length ? `RSR took ${plural(assets.trainIds.length, 'train')}` : undefined,
        details.stations.length
            ? `RSR took ${plural(details.stations.length, 'station')}`
            : undefined
    )
}

/** 1861's own history rows. */
export function describe1861Action(
    action: GameAction,
    names: HistoryNames & { place: (locationId: string) => string },
    money: MoneyFormat
): HistoryDescription | undefined {
    const { companyName, playerName } = names
    if (isSettleLoans(action)) {
        const settled = action.metadata
        if (!settled) return { text: 'Loans settled', routine: true }
        if (settled.nationalisation)
            return {
                text: `${companyName(action.companyId)} could not pay its interest and was nationalised`,
                detail: nationalisationDetail(settled.nationalisation, names, money),
                companyToken: action.companyId,
                important: true
            }
        if (!settled.interest && !settled.repayments.length)
            return { text: 'No loans', routine: true }
        return {
            text: `${companyName(action.companyId)} settled its loans`,
            detail: joinDetails(
                settled.interest ? `${money(settled.interest)} interest` : undefined,
                settled.loans.length
                    ? `borrowed ${plural(settled.loans.length, 'loan')} for it`
                    : undefined,
                settled.repayments.length
                    ? `repaid ${plural(settled.repayments.length, 'loan')}`
                    : undefined
            )
        }
    }
    if (isNationaliseCompany(action))
        return {
            text: `${companyName(action.companyId)} ended its turn without a train and was nationalised`,
            detail: action.metadata
                ? nationalisationDetail(action.metadata, names, money)
                : undefined,
            companyToken: action.companyId,
            important: true
        }
    if (isPlaceStateStation(action))
        return {
            text: `The Russian State Railway placed its station in ${names.place(action.locationId)}`,
            important: true
        }
    if (isApplyPhaseEffects(action)) {
        const effects = action.metadata
        if (!effects) return { text: `Phase ${action.phaseId} began`, routine: true }
        const lines = [
            ...(effects.rsrStarted ? ['The Russian State Railway begins to operate'] : []),
            ...(effects.withdrawnMinorIds.length
                ? [`Unsold minors leave the game: ${effects.withdrawnMinorIds.join(', ')}`]
                : []),
            ...effects.privates.map(
                (entry) =>
                    `${companyName(entry.privateId)} nationalised for ${money(entry.payment.amount)}`
            ),
            ...effects.nationalisations.map(
                (entry) =>
                    `${companyName(entry.companyId)} nationalised (${money(entry.price)} a share)`
            ),
            ...effects.trainlessMajorIds.map(
                (companyId) => `${companyName(companyId)} has no train; its director decides`
            )
        ]
        return lines.length
            ? {
                  text: `Phase ${action.phaseId}: nationalisations`,
                  detailLines: lines,
                  important: true
              }
            : { text: `Phase ${action.phaseId} began`, routine: true }
    }
    if (isDecideTrainlessMajor(action))
        return action.nationalise
            ? {
                  text: `Nationalised ${companyName(action.companyId)}`,
                  detail: action.metadata?.nationalisation
                      ? nationalisationDetail(action.metadata.nationalisation, names, money)
                      : undefined,
                  companyToken: action.companyId,
                  important: true
              }
            : { text: `Kept ${companyName(action.companyId)} without a train` }
    if (isStartMergerRound(action)) return { text: 'Merger round', routine: true }
    if (isEndMergerRound(action)) return { text: 'Merger round ended', routine: true }
    if (isPassMerger(action)) return { text: `Passed with ${companyName(action.minorId)}` }
    if (isProposeMerger(action))
        return {
            text:
                action.kind === 'convert'
                    ? `Proposed converting ${companyName(action.minorId)} into ${companyName(action.majorId)}`
                    : `Proposed merging ${action.minorIds.join(', ')} into ${companyName(action.majorId)}`,
            important: true
        }
    if (isAnswerMerger(action))
        return { text: action.accept ? 'Agreed to the merger' : 'Refused the merger' }
    if (isChooseMergerStations(action)) return { text: 'Chose the stations to keep' }
    if (isBuyMergerShares(action)) {
        const formation = action.metadata?.formation
        if (formation)
            return {
                text: `${companyName(formation.majorId)} formed`,
                detail: joinDetails(
                    `${playerName(formation.directorId)} directs`,
                    action.shares ? `bought ${plural(action.shares, 'share')}` : undefined
                ),
                companyToken: formation.majorId,
                milestone: true
            }
        if (action.metadata?.lapsed)
            return { text: 'No one would hold two shares; the merger lapsed', important: true }
        return {
            text: action.shares ? `Bought ${plural(action.shares, 'share')}` : 'Bought no shares'
        }
    }
    if (isDiscardMergerTrain(action)) return { text: 'Discarded a train to the bank pool' }
    return undefined
}
