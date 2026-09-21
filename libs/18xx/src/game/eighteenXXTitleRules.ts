import { type EndingRules } from '../ending/gameEnding.js'
import type { MachineStateHandler, HydratedAction } from '@tabletop/common'
import { Prng } from '@tabletop/common'
import { type OfferPileAuctionRules } from '../auctions/offerPileAuction.js'
import { type WaterfallAuctionRules } from '../auctions/waterfallAuction.js'
import { type TrainFundingRules } from '../funding/trainFunding.js'
import { type TransferRules } from '../transfers/purchaseOffer.js'
import { type PrivatePowerRules } from '../privates/privatePowers.js'
import type { PrivateRules } from '../privates/privateRules.js'
import { type PhaseRules } from '../phases/phaseChange.js'
import { type EarningsRules } from '../earnings/earningsDistribution.js'
import type { RouteRules } from '../routes/routeEvaluation.js'
import { type TrainState } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { type StationRules } from '../stations/stationPlacement.js'
import { type TrackRules } from '../construction/trackConstruction.js'
import { type MapStateData } from '../map/mapState.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import { type OperatingRules } from '../operating/operatingSet.js'
import { type CompanyState } from '../company/companyState.js'
import type { CompanyRules } from '../company/companyRules.js'
import { type PlayerState } from '@tabletop/common'
import { StockMarket } from '../stock/stockMarket.js'
import type { StockRules } from '../stock/stockRules.js'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { HydratedEighteenXXState } from './eighteenXXState.js'
export type InitialFinances = CompanyState & MapStateData & TrainState
export interface EighteenXXTitleRules {
    endingRules: EndingRules
    stockRoundHandler?: MachineStateHandler<HydratedAction, HydratedEighteenXXState>
    titleActions?: readonly ActionDefinition[]
    offerAuctionRules?: OfferPileAuctionRules
    auctionRules?: WaterfallAuctionRules
    trainFundingRules: TrainFundingRules
    createFinances: (players: readonly PlayerState[], prng: Prng) => InitialFinances
    stockRules: StockRules
    createMarket: () => StockMarket
    companyRules: CompanyRules
    operatingRules: OperatingRules
    map: RailwayMap
    tileSet: TileSet
    stationRules: StationRules
    earningsRules: EarningsRules
    routeRules: RouteRules
    trainRules: TrainRules
    phaseRules: PhaseRules
    privateRules: PrivateRules
    transferRules: TransferRules
    privatePowerRules: PrivatePowerRules
    trackRules: TrackRules
}
