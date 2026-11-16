import { defineGame, type GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import { NamesChesapeake } from '../names.js'
import {
    AuctionRulesChesapeake,
    createOpeningChesapeake,
    startingCashChesapeake
} from '../opening.js'
import {
    EarningsRulesChesapeake,
    EndingRulesChesapeake,
    OperatingRulesChesapeake,
    PhaseRulesChesapeake,
    PrivateRulesChesapeake,
    TrainFundingRulesChesapeake,
    TransferRulesChesapeake
} from '../operating.js'
import { PrivatePowerRulesChesapeake } from '../privatePowers.js'
import { RouteRulesChesapeake } from '../routes.js'
import {
    StateChesapeake,
    StateDefinitionChesapeake,
    type HydratedStateChesapeake
} from '../state.js'
import { StationRulesChesapeake } from '../stations.js'
import { CompanyRulesChesapeake, StockRulesChesapeake } from '../stock.js'
import { TrackRulesChesapeake } from '../track.js'
import { PhasesChesapeake, TrainRulesChesapeake } from '../trains.js'
import { InfoChesapeake } from './info.js'

export const TitleRulesChesapeake: EighteenXXTitleRules<
    typeof StateChesapeake,
    HydratedStateChesapeake
> = {
    state: StateDefinitionChesapeake,
    endingRules: EndingRulesChesapeake,
    names: NamesChesapeake,
    auctionRules: AuctionRulesChesapeake,
    trainFundingRules: TrainFundingRulesChesapeake,
    transferRules: TransferRulesChesapeake,
    privatePowerRules: PrivatePowerRulesChesapeake,
    createOpening: createOpeningChesapeake,
    startingCash: startingCashChesapeake,
    currencySymbol: '$',
    stockRules: StockRulesChesapeake,
    companyRules: CompanyRulesChesapeake,
    operatingRules: OperatingRulesChesapeake,
    trackRules: TrackRulesChesapeake,
    stationRules: StationRulesChesapeake,
    earningsRules: EarningsRulesChesapeake,
    routeRules: RouteRulesChesapeake,
    privateRules: PrivateRulesChesapeake,
    phases: PhasesChesapeake,
    phaseRules: PhaseRulesChesapeake,
    trainRules: TrainRulesChesapeake,
    runInstructions: true
}

export const Definition: GameDefinition<StateChesapeake, HydratedStateChesapeake> = defineGame({
    info: InfoChesapeake,
    runtime: createEighteenXXRuntime(TitleRulesChesapeake)
})
