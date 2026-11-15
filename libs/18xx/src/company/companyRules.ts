import type { CertificateExchange } from '../finance/certificateExchange.js'
import type { TrainState } from '../trains/train.js'
import type { Owner } from '../finance/finance.js'
import type { FormationState } from './companyState.js'
import type { SharePurchaseTerms } from '../stock/sharePurchase.js'
import type { CashPayment } from '../finance/cashPayments.js'
import type { CompanyStartDetails } from './companyStart.js'
import type { StationPosition } from '../map/station.js'

/** A city a company may start in, with what its treasury pays for the home there. */
export type StartHome = StationPosition & {
    cost: number
    /**
     * The home is only claimed as the company starts, to be placed as it first operates: this
     * city, or any open city of its hex. Otherwise the home is placed as the company starts.
     */
    claims?: StartHomeClaim
}
export type StartHomeClaim = 'city' | 'hex'

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
     * How many ordinary certificates the president may buy with the president's certificate in
     * the start itself, as 1849's president takes up to 40% (§9.4); none unless given.
     */
    additionalStartCertificates?(state: FormationState, companyId: string): number
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
    /** The par spaces open to a player setting par after an award; ``startMarketSpaces`` unless given. */
    awardParSpaces?(state: FormationState, companyId: string): string[]
}
