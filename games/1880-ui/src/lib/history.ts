import {
    isAssignEngineer,
    isChooseInvestor,
    isClaimWoosongPayment,
    isExchangeRocket,
    isJoinInvestor,
    isLeaseTrain,
    isMergeInvestor,
    isReplaceInvestorStation,
    isReturnLeasedTrain,
    CommunistPhaseId,
    ReopeningPhaseId
} from '@tabletop/1880'
import { isAdvancePhase, isFinishOperatingTurn, isRepayPlayerLoan } from '@tabletop/18xx'
import {
    declinedTrainsWords,
    joinDetails,
    type TitleCallout,
    type HistoryDescription,
    type MoneyFormat,
    type TitleHistoryNames
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

/** The Communist Takeover beginning with the first 4-train (§XIV). */
const TakeoverCallout: TitleCallout = {
    title: 'Communist Takeover',
    text: 'Share prices are frozen and directors may not sell their own companies’ shares until the first 6-train. Privates pay nothing and foreign investors stop operating, for the rest of the game.'
}

/** The Communist Takeover ending with the first 6-train (§XIV End). */
const ReopeningCallout: TitleCallout = {
    title: 'The Shanghai Stock Exchange reopens',
    text: 'Communism ends: share prices move again and directors may sell their own companies’ shares. Privates still pay nothing and foreign investors stay idle.'
}

/**
 * 1880's own history rows: investors, the privates' powers and debts; the Communist Takeover's
 * start and end, and trains leaving the game unbought, called out under their rows.
 */
export function describe1880Action(
    action: GameAction,
    { companyName }: TitleHistoryNames,
    money: MoneyFormat,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    if (isAdvancePhase(action)) {
        const toPhaseId = action.metadata?.event.toPhaseId
        const callout =
            toPhaseId === CommunistPhaseId
                ? TakeoverCallout
                : toPhaseId === ReopeningPhaseId
                  ? ReopeningCallout
                  : undefined
        return callout ? { ...shared(), callouts: [callout] } : undefined
    }
    if (isFinishOperatingTurn(action) && action.metadata?.declinedTrains) {
        const { trains, toPhaseId } = action.metadata.declinedTrains
        return {
            ...shared(),
            callouts: [
                {
                    title: 'Unbought trains leave the game',
                    text: `A whole round passed with no new train bought: ${declinedTrainsWords(trains).join(', ')}${toPhaseId ? `, starting phase ${toPhaseId}` : ''}.`
                }
            ]
        }
    }
    if (isChooseInvestor(action))
        return { text: `Chose ${companyName(action.investorId)}`, companyToken: action.investorId }
    if (isLeaseTrain(action))
        return {
            text: `${companyName(action.companyId)} leased the train on sale`,
            omitActor: true,
            routine: true
        }
    if (isReturnLeasedTrain(action))
        return {
            text: `${companyName(action.companyId)} returned its leased train`,
            omitActor: true,
            routine: true
        }
    if (isJoinInvestor(action)) {
        const details = action.metadata
        return {
            text: details
                ? `${companyName(action.investorId)} joined ${companyName(details.companyId)}’s network`
                : `${companyName(action.investorId)} joined its company’s network`,
            omitActor: true,
            important: true,
            detail: `its owner takes the reserved share and ${money(50)}`
        }
    }
    if (isMergeInvestor(action))
        return {
            text: `Merged the investor, its treasury to ${action.treasuryTo === 'company' ? 'the company' : 'its owner'}`,
            value: action.metadata ? money(action.metadata.amount) : undefined,
            detail: action.metadata?.stationChooser
                ? 'the company’s director chooses whether its station takes its place'
                : action.metadata?.stationId
                  ? 'the company’s station took its place'
                  : 'its station left the board'
        }
    if (isReplaceInvestorStation(action))
        return {
            text: action.metadata
                ? `${companyName(action.metadata.companyId)}’s station ${action.metadata.stationId ? 'took' : 'did not take'} ${companyName(action.metadata.investorId)}’s place`
                : 'Chose the merged investor’s station',
            detail: action.metadata?.stationId ? undefined : 'its station left the board'
        }
    if (isClaimWoosongPayment(action))
        return { text: 'Took P0’s payment', value: money(action.amount), important: true }
    if (isAssignEngineer(action))
        return { text: `Gave ${companyName(action.companyId)} P5’s D permit`, important: true }
    if (isExchangeRocket(action)) {
        const details = action.metadata
        return {
            text: `Exchanged the Rocket of China for ${companyName(action.companyId)}’s ${details?.definitionId ?? ''}-train`,
            companyToken: action.companyId,
            important: true,
            detail: joinDetails(
                action.discardTrainId ? 'a train given up to make room' : undefined,
                details?.toPhaseId ? `phase ${details.toPhaseId}` : undefined
            )
        }
    }
    if (isRepayPlayerLoan(action))
        return {
            text: 'Repaid debt',
            value: money(action.amount),
            detail: action.metadata?.remaining
                ? `${money(action.metadata.remaining)} still owed`
                : 'debt cleared'
        }
    return undefined
}
