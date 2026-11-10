import {
    DirectorShares,
    NonCharteredStationCost,
    WarrantyCost,
    isAnswerMerger,
    isBankruptCompany,
    isBuildToLondon,
    isBuyStations,
    isBuyWarranties,
    isCompleteShareMerge,
    isDecideOption,
    isDeclineCharter,
    isEndParliamentRound,
    isEnforceObligations,
    isExpireWarranties,
    isForgiveFine,
    isFormLner,
    isGoBankrupt,
    isObtainCharter,
    isOpenCharterAuction,
    isPassCharterBid,
    isPlaceHome,
    isPlaceSmallStation,
    isProposeMerger,
    isRaiseCharterBid,
    isRedeemShare,
    isRefinance,
    isSellForFine,
    isSellTreasuryShares,
    isStartParliamentRound,
    isTakeMergeTurn
} from '@tabletop/1862'
import type { GameAction } from '@tabletop/common'
import type { HistoryDescription, MoneyFormat, TitleHistoryNames } from '@tabletop/18xx-ui'

type Names = {
    getPlayerName(playerId: string): string
    presentation: { money: MoneyFormat }
    companyInitials(companyId: string): string
}

/** History rows for 1862's own Actions; the family describes the rest. */
export function describe1862Action(
    action: GameAction,
    names: TitleHistoryNames,
    session: Names
): HistoryDescription | undefined {
    const money = session.presentation.money
    const company = names.companyName
    if (isStartParliamentRound(action))
        return { text: 'Parliament sat', omitActor: true, routine: true, important: true }
    if (isEndParliamentRound(action))
        return { text: 'Parliament rose', omitActor: true, routine: true }
    if (isOpenCharterAuction(action))
        return {
            text: `petitioned for ${company(action.companyId)}`,
            value: money(action.bid),
            companyToken: action.companyId
        }
    if (isDeclineCharter(action)) return { text: 'declined to petition', routine: true }
    if (isRaiseCharterBid(action)) return { text: 'raised the bid', value: money(action.bid) }
    if (isPassCharterBid(action)) return { text: 'passed', routine: true }
    if (isObtainCharter(action)) {
        const shares = DirectorShares + action.extraShares
        return {
            text: `chartered ${company(action.companyId)} at ${money(action.parPrice)}, buying ${shares} shares`,
            value: money((action.metadata?.bid ?? 0) + shares * action.parPrice),
            companyToken: action.companyId,
            important: true
        }
    }
    if (isBuyStations(action))
        return {
            text: `bought ${action.count} stations for ${company(action.companyId)}`,
            value: money(action.count * NonCharteredStationCost)
        }
    if (isEnforceObligations(action))
        return {
            text: (action.metadata?.fines ?? [])
                .map(
                    (fine) =>
                        `${session.getPlayerName(fine.playerId)} was fined ${money(fine.fine)} for ${company(fine.companyId)}`
                )
                .join('; '),
            omitActor: true,
            important: true
        }
    if (isSellForFine(action))
        return {
            text: `sold ${action.shares} ${session.companyInitials(action.companyId)} toward a fine`
        }
    if (isForgiveFine(action)) return { text: 'A fine was left unpaid', omitActor: true }
    if (isPlaceHome(action)) {
        const displaced = action.metadata?.displacedStationId
        return {
            text: `${company(action.companyId)} placed its home station${displaced ? ', displacing another' : ''}`,
            omitActor: true,
            routine: !displaced,
            companyToken: action.companyId
        }
    }
    if (isPlaceSmallStation(action))
        return { text: `placed a small station in ${names.place(action.locationId)}` }
    if (isBuildToLondon(action))
        return { text: `built ${company(action.companyId)} to London`, important: true }
    if (isBuyWarranties(action))
        return {
            text: `bought ${action.count === 1 ? 'a warranty' : `${action.count} warranties`}`,
            value: money(action.count * WarrantyCost)
        }
    if (isExpireWarranties(action)) {
        const rusted = action.metadata?.rusted.length ?? 0
        return {
            text: rusted
                ? `Warranties expired; ${rusted} train${rusted > 1 ? 's' : ''} rusted`
                : 'Warranties expired',
            omitActor: true,
            routine: !rusted
        }
    }
    if (isSellTreasuryShares(action))
        return {
            text: `sold ${action.shares} of ${company(action.companyId)}’s own shares`,
            value: money(action.metadata?.proceeds ?? 0)
        }
    if (isRefinance(action))
        return { text: `refinanced ${company(action.companyId)}`, important: true }
    if (isRedeemShare(action))
        return { text: `redeemed a ${session.companyInitials(action.companyId)} share` }
    if (isGoBankrupt(action) || isBankruptCompany(action))
        return {
            text: `${company(action.companyId)} went bankrupt`,
            omitActor: isBankruptCompany(action),
            companyToken: action.companyId,
            important: true
        }
    if (isProposeMerger(action))
        return {
            text: `proposed joining ${company(action.companyId)} and ${company(action.partnerId)}, ${company(action.survivorId)} surviving`
        }
    if (isAnswerMerger(action))
        return { text: action.accept ? 'agreed to the merger' : 'refused the merger' }
    if (isTakeMergeTurn(action))
        return { text: 'Shares merged two for one', omitActor: true, routine: true }
    if (isDecideOption(action))
        return {
            text: action.redeem ? 'redeemed an option share' : 'gave up an option share'
        }
    if (isCompleteShareMerge(action)) {
        const capital = action.metadata?.refinancing
        return {
            text: capital !== undefined ? 'The refinancing was settled' : 'The merger was settled',
            ...(capital !== undefined ? { value: money(capital) } : {}),
            omitActor: true,
            important: true
        }
    }
    if (isFormLner(action))
        return {
            text: `The LNER formed; the certificate limit is now ${action.metadata?.certificateLimit ?? 0}`,
            omitActor: true,
            important: true
        }
    return undefined
}
