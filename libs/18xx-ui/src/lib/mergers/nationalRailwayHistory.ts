import {
    isAnswerMerger,
    isApplyPhaseEffects,
    isBuyMergerShares,
    isChooseMergerStations,
    isDecideTrainlessMajor,
    isDiscardMergerTrain,
    isEndMergerRound,
    isNationaliseCompany,
    isPlaceStateStation,
    isPassMerger,
    isProposeMerger,
    isSettleLoans,
    isStartMergerRound,
    type Nationalisation
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import type { MoneyFormat } from '../presentation/money.js'
import {
    joinDetails,
    type HistoryDescription,
    type HistoryNames
} from '../table/historyDescription.js'

/** How the history names the national company, and what its start means. */
export type NationalRailwayNames = {
    /** Its name, as in "The Russian State Railway placed its station". */
    name: string
    /** Its initials, as in "RSR took 2 trains". */
    initials: string
    /** What its start means, as "The Russian State Railway begins to operate". */
    started: string
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/** What a nationalisation paid and gave the national company. */
function nationalisationDetail(
    details: Nationalisation,
    names: HistoryNames,
    money: MoneyFormat,
    national: NationalRailwayNames
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
        assets?.trainIds.length
            ? `${national.initials} took ${plural(assets.trainIds.length, 'train')}`
            : undefined,
        details.stations.length
            ? `${national.initials} took ${plural(details.stations.length, 'station')}`
            : undefined
    )
}

/**
 * History rows for a national railway title's actions: loan settlements, nationalisations, phase
 * effects, trainless decisions and merger rounds (1861, 1867).
 */
export function describeNationalRailwayAction(
    action: GameAction,
    names: HistoryNames & { place: (locationId: string) => string },
    money: MoneyFormat,
    national: NationalRailwayNames
): HistoryDescription | undefined {
    const { companyName, playerName } = names
    if (isPlaceStateStation(action))
        return {
            text: `${national.name} placed its station in ${names.place(action.locationId)}`,
            important: true
        }
    if (isSettleLoans(action)) {
        const settled = action.metadata
        if (!settled) return { text: 'Loans settled', routine: true }
        if (settled.nationalisation)
            return {
                text: `${companyName(action.companyId)} could not pay its interest and was nationalised`,
                detail: nationalisationDetail(settled.nationalisation, names, money, national),
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
                ? nationalisationDetail(action.metadata, names, money, national)
                : undefined,
            companyToken: action.companyId,
            important: true
        }
    if (isApplyPhaseEffects(action)) {
        const effects = action.metadata
        if (!effects) return { text: `Phase ${action.phaseId} began`, routine: true }
        const lines = [
            ...(effects.nationalStarted ? [national.started] : []),
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
                      ? nationalisationDetail(
                            action.metadata.nationalisation,
                            names,
                            money,
                            national
                        )
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
