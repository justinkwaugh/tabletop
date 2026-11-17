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

/** A decision the president makes as they start a company, such as 1880's building permits. */
export type StartChoice = {
    id: string
    label: string
    options: readonly { id: string; label: string }[]
}
/** What a start's choices may depend on: its par and the size of its president's certificate. */
export type StartChoiceContext = { marketSpaceId: string; presidentShares: number }

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
     * The sizes, in shares, the president's certificate may take as the company starts, the
     * printed size first; a larger one takes the place of as many ordinary certificates, which
     * leave the game, as 1880's 30% and 40% director's certificates (§XII).
     */
    presidentShareSizes?(state: FormationState, companyId: string): readonly number[]
    /** The ordinary certificates a larger president's certificate replaces, by preference. */
    certificatesReplacedByPresident?(state: FormationState, companyId: string): readonly string[]
    /** The title's decisions the president makes in starting the company, each a list of options. */
    startChoices?(
        state: FormationState,
        companyId: string,
        start: StartChoiceContext
    ): readonly StartChoice[]
    /** Records the start's choices, after the company has started or its par has been set. */
    applyStartChoices?(
        state: FormationState,
        companyId: string,
        choices: Readonly<Record<string, string>>
    ): void
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
    /**
     * Companies float only as the stock round ends, once every player has passed, rather than
     * as their shares are bought, as in 1880 (§XII).
     */
    floatsAtRoundEnd?: true
    /** The par spaces open to a player setting par after an award; ``startMarketSpaces`` unless given. */
    awardParSpaces?(state: FormationState, companyId: string): string[]
}
