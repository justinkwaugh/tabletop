import type { TitleNames } from './titleNames.js'
import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { type OfferPileAuctionRules } from '../auctions/offerPileAuction.js'
import { type SelectionAuctionRules } from '../auctions/selectionAuction.js'
import { type WaterfallAuctionRules } from '../auctions/waterfallAuction.js'
import type { CompanyRules } from '../company/companyRules.js'
import { type TrackRules } from '../construction/trackConstruction.js'
import { type EarningsRules } from '../earnings/earningsDistribution.js'
import { type EndingRules } from '../ending/gameEnding.js'
import type { CashCrisisRules } from '../funding/cashCrisis.js'
import { type TrainFundingRules } from '../funding/trainFunding.js'
import type { LoanRules } from '../loans/loans.js'
import { type OperatingRules } from '../operating/operatingSet.js'
import { type PhaseRules } from '../phases/phaseChange.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import { type PrivatePowerRules } from '../privates/privatePowers.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { RouteRules } from '../routes/routeEvaluation.js'
import { type StationRules } from '../stations/stationPlacement.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { type TransferRules } from '../transfers/purchaseOffer.js'
import type {
    EighteenXXMachineState,
    EighteenXXRuntimeSchema,
    EighteenXXStateDefinition,
    HydratedEighteenXXState,
    TitleStateSchema
} from './eighteenXXState.js'
import type { Opening, OpeningSetup } from './opening.js'
export type EighteenXXStateHandler<
    State extends HydratedEighteenXXState = HydratedEighteenXXState
> = MachineStateHandler<HydratedAction, State>
export interface EighteenXXTitleRules<
    Schema extends TitleStateSchema = EighteenXXRuntimeSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState =
        HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> {
    endingRules: EndingRules
    names: TitleNames
    state: EighteenXXStateDefinition<Schema, State>
    decisionHandlers?: Partial<
        Record<
            EighteenXXMachineState,
            (family: EighteenXXStateHandler<State>) => EighteenXXStateHandler<State>
        >
    >
    titleStateHandlers?: Readonly<Record<string, EighteenXXStateHandler<State>>>
    titleActions?: readonly ActionDefinition[]
    offerAuctionRules?: OfferPileAuctionRules
    auctionRules?: WaterfallAuctionRules
    selectionAuctionRules?: SelectionAuctionRules
    trainFundingRules: TrainFundingRules
    createOpening: (setup: OpeningSetup) => Opening<Schema, State>
    stockRules: StockRules
    companyRules: CompanyRules
    operatingRules: OperatingRules
    stationRules: StationRules
    earningsRules: EarningsRules
    routeRules: RouteRules
    trainRules: TrainRules
    phases: PhaseTable
    phaseRules: PhaseRules
    privateRules: PrivateRules
    transferRules: TransferRules
    privatePowerRules: PrivatePowerRules
    outOfTurnPrivatePowers?: boolean
    trackRules: TrackRules
    /** Title actions in the track step that keep it open while one is still possible. */
    additionalConstructionActions?: readonly string[]
    loanRules?: LoanRules
    cashCrisisRules?: CashCrisisRules
}
