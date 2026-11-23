import type {
    AcquisitionRounds,
    CompanyExcess,
    ConversionRounds,
    CorporateBuyBacks,
    EighteenXXState,
    HydratedEighteenXXState,
    LoanRules,
    ShortSelling,
    SizedCompanyMarket,
    SizedCompanyStations,
    TitleStateSchema
} from '@tabletop/18xx'
import type { MapViewDefinition } from '../maps/stationPresentation.js'
import type { QueuedRouteWorker } from '../routes/routeSolveQueue.js'
import {
    EighteenXXSession,
    type EighteenXXSessionRules,
    type EighteenXXSessionView,
    type MapLocationChoice,
    type SessionOptions
} from './eighteenXXSession.svelte.js'
import {
    AcquisitionRoundModule,
    CompanyExcessModule,
    ConversionRoundModule,
    CorporateBuyBackModule,
    ShortSellingModule
} from './sizedCompanyModules.svelte.js'
import type { TitlePresentation } from './titlePresentation.js'
import type { TitleStockPanels } from './titleStockPanels.svelte.js'

/** The family mechanisms a title whose companies change size composes, as 1817 does. */
export type SizedCompanyMechanisms = {
    market: SizedCompanyMarket
    stations: SizedCompanyStations
    loanRules: LoanRules
    conversionRounds: ConversionRounds
    acquisitionRounds: AcquisitionRounds
    excess: CompanyExcess
    shortSelling: ShortSelling
    buyBacks: CorporateBuyBacks
}

/** The stock-round panels a sized-company title adds beside Buy and Sell. */
export type SizedCompanyStockPanel = 'company' | 'short'

/** What the sized-company panels read from their session. */
export type SizedCompanySessionView = EighteenXXSessionView & {
    readonly sizedCompanies: SizedCompanyMechanisms
    readonly conversions: ConversionRoundModule
    readonly acquisitions: AcquisitionRoundModule
    readonly excess: CompanyExcessModule
    readonly shortSelling: ShortSellingModule
    readonly buyBacks: CorporateBuyBackModule
    readonly stockPanels: TitleStockPanels<SizedCompanyStockPanel>
}

/**
 * The session of a title whose companies start at a chosen size, convert and merge between
 * operating rounds, are sold to one another, and can be shorted, as the 1817 family's.
 */
export class SizedCompanySession<
    Schema extends TitleStateSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> extends EighteenXXSession<Schema, State> {
    readonly sizedCompanies: SizedCompanyMechanisms
    readonly conversions: ConversionRoundModule
    readonly acquisitions: AcquisitionRoundModule
    readonly excess: CompanyExcessModule
    readonly shortSelling: ShortSellingModule
    readonly buyBacks: CorporateBuyBackModule
    readonly stockPanels: TitleStockPanels<SizedCompanyStockPanel>

    constructor(
        options: SessionOptions<Schema, State>,
        definition: {
            rules: EighteenXXSessionRules<Schema, State>
            mapView: MapViewDefinition
            presentation: TitlePresentation<EighteenXXState<Schema>>
            mechanisms: SizedCompanyMechanisms
            createRouteWorker?: () => QueuedRouteWorker
            /**
             * The title's own actions a president may take for a company on a stock turn, as
             * 18USA's scrapping a Pullman, which open the company action panel too.
             */
            corporateTitleActions?: readonly string[]
        }
    ) {
        super(
            options,
            definition.rules,
            definition.mapView,
            definition.presentation,
            definition.createRouteWorker
        )
        const mechanisms = definition.mechanisms
        this.sizedCompanies = mechanisms
        this.conversions = new ConversionRoundModule(
            this.moduleSession,
            mechanisms.conversionRounds
        )
        this.acquisitions = new AcquisitionRoundModule(
            this.moduleSession,
            mechanisms.acquisitionRounds
        )
        this.excess = new CompanyExcessModule(this.moduleSession, mechanisms.excess)
        this.shortSelling = new ShortSellingModule(this.moduleSession, mechanisms.shortSelling)
        this.buyBacks = new CorporateBuyBackModule(this.moduleSession, mechanisms.buyBacks)
        this.stockPanels = this.titleStockPanels<SizedCompanyStockPanel>([
            {
                id: 'company',
                label: 'Company action',
                available: () =>
                    this.buyBacks.options.length > 0 ||
                    (definition.corporateTitleActions ?? []).some((type) =>
                        this.validActionTypes.includes(type)
                    ),
                held: () => !!this.gameState.stockRound.turn.corporateAction
            },
            {
                id: 'short',
                label: 'Short',
                available: () => this.shortSelling.options.length > 0
            }
        ])
    }

    override get mapLocationChoice(): MapLocationChoice | undefined {
        return this.excess.mapChoice ?? super.mapLocationChoice
    }
}
