import {
    bankruptcyRestoredLoans,
    isBeginNationalFormation,
    isBuyNationalMarketShare,
    isCapitalizeCompany,
    isBorrowTrain,
    isChooseNationalStations,
    isChooseNationalTrains,
    isCompleteNationalPresidency,
    isFormNational,
    isPassOverCompany,
    isReachDestination,
    isRedeemExcessLoans,
    isSettleNationalLoans
} from '@tabletop/1856'
import { isGoBankrupt, isPayInterest } from '@tabletop/18xx'
import {
    joinDetails,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/** 1856's own history rows, and its interest, which comes off the run before the president pays. */
export function describe1856Action(
    action: GameAction,
    names: HistoryNames,
    money: MoneyFormat
): HistoryDescription | undefined {
    const { companyName, playerName } = names
    if (isPayInterest(action)) {
        const paid = action.metadata
        if (!paid) return { text: 'Interest', routine: true }
        const unpaid = paid.default
        const fromRevenue = unpaid?.fromRevenue ?? 0
        const fromPresident = (unpaid?.payments ?? [])
            .filter((payment) => payment.from.kind === 'player')
            .reduce((sum, payment) => sum + payment.amount, 0)
        return {
            text: `${companyName(action.companyId)} paid interest`,
            omitActor: true,
            value: money(paid.interest),
            detail: joinDetails(
                fromRevenue ? `${money(fromRevenue)} off its run` : undefined,
                fromPresident ? `its president paid ${money(fromPresident)}` : undefined,
                unpaid?.unpaid ? `${money(unpaid.unpaid)} to raise by selling shares` : undefined
            ),
            important: !!unpaid,
            routine: !unpaid
        }
    }
    if (isGoBankrupt(action)) {
        const restored = bankruptcyRestoredLoans(action.metadata?.changes)
        if (!restored || !action.metadata) return undefined
        return {
            text: 'Went bankrupt',
            detail: joinDetails(
                `${money(action.metadata.forgiven)} forgiven`,
                `${companyName(restored.companyId)} keeps ${plural(restored.loans, 'unredeemed loan')}`
            ),
            important: true
        }
    }
    if (isReachDestination(action))
        return {
            text: `${companyName(action.companyId)} reached its destination`,
            omitActor: true,
            ...(action.metadata?.release
                ? { value: money(action.metadata.release.amount), detail: 'Escrow released' }
                : {}),
            companyToken: action.companyId,
            milestone: true
        }
    if (isCapitalizeCompany(action))
        return {
            text: `${companyName(action.companyId)} received its capital`,
            omitActor: true,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {}),
            detail: 'Ten times par, at its sixth share',
            companyToken: action.companyId
        }
    if (isBuyNationalMarketShare(action))
        return {
            text: 'Bought an open-market CGR share, as the market held too many',
            value: money(action.expectedPrice),
            detail: action.metadata?.unpaid
                ? `${money(action.metadata.unpaid)} to raise by selling shares`
                : undefined,
            companyToken: 'CGR',
            important: !!action.metadata?.unpaid
        }
    if (isPassOverCompany(action))
        return {
            text: `${companyName(action.companyId)} has too few shares sold to operate`,
            omitActor: true,
            routine: true
        }
    if (isRedeemExcessLoans(action)) {
        const redeemed = action.metadata
        return {
            text: `${companyName(action.companyId)} redeemed loans beyond its players’ shares`,
            omitActor: true,
            ...(redeemed ? { value: plural(redeemed.loans, 'loan') } : {}),
            detail: redeemed?.unpaid
                ? `Its president must raise ${money(redeemed.unpaid)}`
                : undefined,
            important: true
        }
    }
    if (isBeginNationalFormation(action)) {
        const begun = action.metadata
        return {
            text: 'The Canadian Government Railways forms',
            omitActor: true,
            detail: joinDetails(
                begun?.repayments.length
                    ? `${plural(begun.repayments.length, 'loan')} repaid from treasuries`
                    : undefined,
                begun?.owing.length
                    ? `still owing: ${begun.owing.map((id) => companyName(id)).join(', ')}`
                    : 'every loan repaid',
                begun?.portRemoved ? 'port token removed' : undefined
            ),
            important: true
        }
    }
    if (isSettleNationalLoans(action))
        return action.repay
            ? {
                  text: `Repaid ${companyName(action.companyId)}’s loans`,
                  value: money(
                      (action.metadata?.payments ?? []).reduce(
                          (sum, payment) => sum + payment.amount,
                          0
                      )
                  )
              }
            : {
                  text: `${companyName(action.companyId)} joins the CGR`,
                  companyToken: action.companyId,
                  important: true
              }
    if (isFormNational(action)) {
        const formed = action.metadata
        if (!formed?.absorbed.length)
            return { text: 'The CGR does not form', omitActor: true, important: true }
        return {
            text: `The CGR formed from ${formed.absorbed.map((id) => companyName(id)).join(', ')}`,
            omitActor: true,
            detailLines: [
                ...formed.players.map(
                    (entry) => `${playerName(entry.playerId)} ${plural(entry.shares, 'share')}`
                ),
                ...(formed.market ? [`Open market ${plural(formed.market, 'share')}`] : []),
                `${formed.shareCount} shares; treasury ${money(formed.cash)}`,
                ...(formed.presidentId
                    ? [
                          `${playerName(formed.presidentId)} president${formed.owesSecondShare ? ', owing a second share' : ''}`
                      ]
                    : [])
            ],
            companyToken: 'CGR',
            milestone: true
        }
    }
    if (isChooseNationalStations(action))
        return { text: `Kept ${plural(action.stationIds.length, 'station')} for the CGR` }
    if (isChooseNationalTrains(action))
        return { text: `Kept ${plural(action.trainIds.length, 'train')} for the CGR` }
    if (isBorrowTrain(action))
        return {
            text: `The CGR borrowed a ${action.definitionId}-train`,
            omitActor: true,
            trainDefinitionIds: [action.definitionId]
        }
    if (isCompleteNationalPresidency(action))
        return {
            text: 'Bought the second share of the CGR presidency',
            value: money(action.expectedPrice)
        }
    if (
        action.type === 'ReturnBorrowedTrain' ||
        action.type === 'NoteNationalPermanentTrain' ||
        action.type === 'CloseWaterloo'
    )
        return {
            text:
                action.type === 'CloseWaterloo'
                    ? 'The Waterloo & Saugeen closed'
                    : action.type === 'ReturnBorrowedTrain'
                      ? 'The CGR returned its borrowed train'
                      : 'The CGR owns a permanent train: its price moves and it may pay dividends',
            omitActor: true,
            routine: action.type !== 'NoteNationalPermanentTrain'
        }
    return undefined
}
