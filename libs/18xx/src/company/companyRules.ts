import type { CertificateExchange } from '../finance/certificateExchange.js'
import type { TrainState } from '../trains/train.js'
import type { Owner } from '../finance/finance.js'
import type { StockState } from '../stock/stockState.js'
import type { SharePurchaseTerms } from '../stock/sharePurchase.js'
import type { CashPayment } from '../finance/cashPayments.js'
import type { CompanyStartDetails } from './companyStart.js'

export interface CompanyRules {
    startMarketSpaces(state: StockState, companyId: string): string[]
    startTerms(
        state: StockState,
        companyId: string,
        buyer: Owner,
        marketSpaceId: string
    ): SharePurchaseTerms | string
    flotationPayments(state: StockState, companyId: string): CashPayment[] | undefined
    onStart?(state: StockState, details: CompanyStartDetails): void
    onFloat?(state: StockState & TrainState, companyId: string): CertificateExchange[] | void
}
