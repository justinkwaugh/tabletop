import type { CertificateExchange } from '../finance/certificateExchange.js'
import type { TrainState } from '../trains/train.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { SharePurchaseTerms } from '../stock/sharePurchase.js'
import type { CashPayment } from '../finance/cashPayments.js'
import type { CompanyStartDetails } from './companyStart.js'
import type { StationPosition } from '../map/station.js'

/** A city a company may start in, with what its treasury pays for the home there. */
export type StartHome = StationPosition & { cost: number }

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
    /**
     * The homes a company's president chooses among as they start it, for companies without a
     * fixed home; a list, even an empty one, means the start needs a home.
     */
    startHomes?(
        state: FormationState,
        companyId: string,
        marketSpaceId: string
    ): StartHome[] | undefined
    onFloat?(state: FormationState & TrainState, companyId: string): CertificateExchange[] | void
    /**
     * Opening awards may give a president's certificate before its company has a par; the
     * auction waits while the new owner sets it.
     */
    parAfterAward?: true
}
