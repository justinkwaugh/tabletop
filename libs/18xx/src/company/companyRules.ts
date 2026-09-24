import type { CertificateExchange } from '../finance/certificateExchange.js'
import type { TrainState } from '../trains/train.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { SharePurchaseTerms } from '../stock/sharePurchase.js'
import type { CashPayment } from '../finance/cashPayments.js'
import type { CompanyStartDetails } from './companyStart.js'

export interface CompanyRules {
    startMarketSpaces(state: FormationState, companyId: string): string[]
    startTerms(
        state: FormationState,
        companyId: string,
        buyer: Owner,
        marketSpaceId: string
    ): SharePurchaseTerms | string
    sharesToFloat?(state: FormationState, companyId: string): number | undefined
    flotationPayments(state: FormationState, companyId: string): CashPayment[] | undefined
    onStart?(state: FormationState, details: CompanyStartDetails): void
    onFloat?(state: FormationState & TrainState, companyId: string): CertificateExchange[] | void
}
