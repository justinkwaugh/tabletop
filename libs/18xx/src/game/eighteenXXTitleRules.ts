import { type EndingRules } from '../ending/gameEnding.js'
import type { MachineStateHandler, HydratedAction } from '@tabletop/common'
import { type OfferPileAuctionRules } from '../auctions/offerPileAuction.js'
import { type WaterfallAuctionRules } from '../auctions/waterfallAuction.js'
import { type TrainFundingRules } from '../funding/trainFunding.js'
import { type TransferRules } from '../transfers/purchaseOffer.js'
import { type PrivatePowerRules } from '../privates/privatePowers.js'
import type { PrivateRules } from '../privates/privateRules.js'
import { type PhaseRules } from '../phases/phaseChange.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import { type EarningsRules } from '../earnings/earningsDistribution.js'
import type { RouteRules } from '../routes/routeEvaluation.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { type StationRules } from '../stations/stationPlacement.js'
import { type TrackRules } from '../construction/trackConstruction.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import { type OperatingRules } from '../operating/operatingSet.js'
import type { CompanyRules } from '../company/companyRules.js'
import type { StockRules } from '../stock/stockRules.js'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import type { Opening, OpeningSetup } from './opening.js'
import type {
    EighteenXXMachineState,
    EighteenXXStateDefinition,
    HydratedEighteenXXState
} from './eighteenXXState.js'
export type EighteenXXStateHandler = MachineStateHandler<HydratedAction, HydratedEighteenXXState>
export interface EighteenXXTitleRules {
    endingRules: EndingRules
    state?: EighteenXXStateDefinition
    decisionHandlers?: Partial<
        Record<EighteenXXMachineState, (family: EighteenXXStateHandler) => EighteenXXStateHandler>
    >
    titleStateHandlers?: Readonly<Record<string, EighteenXXStateHandler>>
    titleActions?: readonly ActionDefinition[]
    offerAuctionRules?: OfferPileAuctionRules
    auctionRules?: WaterfallAuctionRules
    trainFundingRules: TrainFundingRules
    createOpening: (setup: OpeningSetup) => Opening
    stockRules: StockRules
    companyRules: CompanyRules
    operatingRules: OperatingRules
    map: RailwayMap
    tileSet: TileSet
    stationRules: StationRules
    earningsRules: EarningsRules
    routeRules: RouteRules
    trainRules: TrainRules
    phases: PhaseTable
    phaseRules: PhaseRules
    privateRules: PrivateRules
    transferRules: TransferRules
    privatePowerRules: PrivatePowerRules
    trackRules: TrackRules
}
