import { getCompany, priceProtectedStock } from '@tabletop/18xx'
import { Charters1850, CompanyIds1850 } from './companies.js'
import { CreditMobilierPrivateId } from './privates.js'
import { requireState1850, type HydratedState1850 } from './state.js'
import { LedgeMarket1850, reissueParForPrice } from './stockMarket.js'
import { Phases1850 } from './trains.js'

const Stock = priceProtectedStock<HydratedState1850>({
    ledgeMarket: LedgeMarket1850,
    charters: Charters1850,
    companyIds: CompanyIds1850,
    phases: Phases1850,
    requireState: requireState1850,
    // For nine companies, and eight or fewer; the limit falls when a company closes (§5.1.1, §21).
    certificateLimits: {
        2: [24, 21],
        3: [17, 15],
        4: [14, 12],
        5: [11, 9],
        6: [9, 8]
    },
    reissueParForPrice,
    // A company reissues once its original offering has sold out, however many reissued shares are
    // still on offer (§5.11).
    reissueNeedsEmptyOffering: false,
    // A company has its treasury from the end of the stock round it floats in (§5.10.8).
    mayRedeem: (company) => !!company.funded,
    // No one may sell what they bought in the initial stock round during it (§5.7).
    privateSalesOpen: (state) => state.stockRound.number !== 1,
    // Owned by a company, the Crédit Mobilier pays that company's president (§4.1.2, §15.2).
    privateIncomeRecipient(state, privateId, owner) {
        if (privateId !== CreditMobilierPrivateId || owner.kind !== 'company') return owner
        return getCompany(state, owner.companyId).president ?? owner
    }
})

export const StockRoundRules1850 = Stock.roundRules
export const OperatingRules1850 = Stock.operatingRules
export const OwnershipExcess1850 = Stock.ownershipExcess
export const PriceProtection1850 = Stock.priceProtection
export const ShareRedemption1850 = Stock.shareRedemption
export const ShareTrading1850 = Stock.shareTrading
export const StockRules1850 = Stock.stockRules
export const TrainFundingRules1850 = Stock.trainFundingRules
export const reissueParPrice = Stock.reissueParPrice
export const tableCertificateLimit = Stock.certificateLimit
