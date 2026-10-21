import type { CertificateExchange } from '../finance/certificateExchange.js'
import type { TrainState } from '../trains/train.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { SharePurchaseTerms } from '../stock/sharePurchase.js'
import type { CashPayment } from '../finance/cashPayments.js'
import type { CompanyStartDetails } from './companyStart.js'
import type { MapStateData } from '../map/mapState.js'

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
    /**
     * Opening awards may give a president's certificate before its company has a par; the
     * auction waits while the new owner sets it.
     */
    parAfterAward?: true
    /** The par spaces open to a player setting par after an award; ``startMarketSpaces`` unless given. */
    awardParSpaces?(state: FormationState, companyId: string): string[]
    /**
     * The homes a company's starting president chooses from, for companies without a printed
     * home, such as 1894's late companies: a hex, and the city when only one may hold it. None
     * means the company cannot start now; undefined, that its home is printed.
     */
    homeChoices?(
        state: FormationState & MapStateData,
        companyId: string
    ): readonly HomeOption[] | undefined
}

/** A home a starting company may take: a city, or any city of a hex when ``nodeId`` is absent. */
export type HomeOption = { locationId: string; nodeId?: string }
