import {
    certificatesOwnedBy,
    getCompany,
    redeemChoices,
    type CorporateFinanceRules,
    type FinancialState
} from '@tabletop/18xx'
import { BelgeCompanyId } from './majors.js'
import { startingFrenchCompanyId } from './privates.js'
import { EighteenNinetyFourMarket, ReissueParSpaceId } from './stockMarket.js'

const ReissuePrice = EighteenNinetyFourMarket.space(ReissueParSpaceId).price
const MarketPoolId = 'open-market'
const IpoPoolId = 'initial-offering'

function companyShares(state: FinancialState, companyId: string, poolId: string) {
    return state.certificates.filter(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            !certificate.president &&
            certificate.owner.kind === 'bank' &&
            certificate.poolId === poolId
    )
}

function ownedShares(state: FinancialState, companyId: string) {
    return certificatesOwnedBy(state, { kind: 'company', companyId }).filter(
        (certificate) => certificate.kind === 'share' && certificate.companyId === companyId
    )
}

/**
 * A company's one financial operation a round (§7.3.2): redeem a share from the bank pool at its
 * price, or two in the set's first round; or reissue every share it owns to the IPO for F100
 * each, which sets its par to ₣100, when it owns more than the IPO holds. The drawn French
 * company and the Belge do neither.
 */
export const EighteenNinetyFourCorporateFinanceRules: CorporateFinanceRules = {
    certificates: (state, companyId, operation) =>
        operation === 'redeem'
            ? companyShares(state, companyId, MarketPoolId)
            : ownedShares(state, companyId),
    destinationPool: (_companyId, operation) => (operation === 'issue' ? IpoPoolId : undefined),
    choices(state, companyId, committed) {
        if (
            committed ||
            companyId === BelgeCompanyId ||
            companyId === startingFrenchCompanyId(state)
        )
            return []
        const price = EighteenNinetyFourMarket.companySpace(state.stockMarket, companyId).price
        const owned = ownedShares(state, companyId).length
        return [
            ...redeemChoices(
                state,
                companyId,
                Math.min(
                    state.operatingSet?.roundNumber === 1 ? 2 : 1,
                    companyShares(state, companyId, MarketPoolId).length
                ),
                price
            ),
            ...(owned > companyShares(state, companyId, IpoPoolId).length
                ? [
                      {
                          companyId,
                          operation: 'issue' as const,
                          shares: owned,
                          amount: ReissuePrice * owned
                      }
                  ]
                : [])
        ]
    },
    afterSettling(state, { companyId, operation }) {
        if (operation === 'issue') getCompany(state, companyId).parPrice = ReissuePrice
    }
}
