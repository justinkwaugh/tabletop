import {
    describeSizedCompanyAction,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'
import {
    DoubleHeadingId,
    EighteenUSALoanRules,
    EighteenUSAMap,
    PennsyBoneyardId,
    PullmanTrainId,
    UnionSwitchId,
    isAssignTrainPower,
    isBuyPullman,
    isSaveTrain,
    isScrapPullman,
    isTurnDenver,
    isUpgradeOre
} from '@tabletop/18usa'

type Names = HistoryNames & { poolName: (poolId: string) => string }

const place = (locationId: string) => EighteenUSAMap.placeName(locationId)

/** The rows of 18USA's own actions: Pullmans, ore, Denver, train powers and the Boneyard. */
function describeTitleAction(
    action: GameAction,
    { companyName }: Names,
    money: MoneyFormat
): HistoryDescription | undefined {
    if (isBuyPullman(action))
        return {
            text: `Bought a Pullman for ${companyName(action.companyId)}`,
            trainDefinitionIds: [PullmanTrainId],
            value: action.metadata && money(action.metadata.payment.amount)
        }
    if (isScrapPullman(action))
        return {
            text: `Scrapped ${companyName(action.companyId)}’s Pullman`,
            value: action.metadata && money(action.metadata.payment.amount)
        }
    if (isUpgradeOre(action))
        return {
            text: `Upgraded the ore at ${place(action.locationId)} for ${companyName(action.companyId)}`,
            value: action.metadata?.payment && money(action.metadata.payment.amount)
        }
    if (isTurnDenver(action))
        return { text: `Turned Denver’s metropolis tile for ${companyName(action.companyId)}` }
    if (isAssignTrainPower(action)) {
        const privateId = action.power === 'double-heading' ? DoubleHeadingId : UnionSwitchId
        return {
            text: `Gave ${companyName(privateId)} to a ${companyName(action.companyId)} train for its run`
        }
    }
    if (isSaveTrain(action))
        return {
            text: action.trainId
                ? `Saved a ${companyName(action.companyId)} train from rusting`
                : `Let ${companyName(action.companyId)}’s trains rust`,
            detail: companyName(PennsyBoneyardId)
        }
    return undefined
}

/** 18USA's history rows: its own actions', then the sized-company mechanisms' over the shared. */
export function eighteenUSAHistoryDescription(
    action: GameAction,
    names: Names,
    money: MoneyFormat,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    return (
        describeTitleAction(action, names, money) ??
        describeSizedCompanyAction(
            action,
            names,
            money,
            {
                poolName: names.poolName,
                place,
                loanValue: EighteenUSALoanRules.value
            },
            shared
        )
    )
}
