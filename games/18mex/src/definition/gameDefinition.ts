import { defineGame, type GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import { MailActions, clearsMailPaid, collectsMailFirst } from '../mail.js'
import { MergerActions, MergingIntoNdmHandler } from '../merger.js'
import { MinorActions, closesMinorsFirst } from '../minors.js'
import { NamesMex } from '../names.js'
import { AuctionRulesMex, createOpeningMex, startingCashMex } from '../opening.js'
import {
    EarningsRulesMex,
    EndingRulesMex,
    OperatingRulesMex,
    PhaseRulesMex,
    PrivatePowerRulesMex,
    PrivateRulesMex,
    TrainFundingRulesMex,
    TrainRulesMex,
    TransferRulesMex
} from '../operating.js'
import { RouteRulesMex } from '../routes.js'
import {
    MergingIntoNdmState,
    StateDefinitionMex,
    StateMex,
    type HydratedStateMex
} from '../state.js'
import { StationRulesMex } from '../stations.js'
import { CompanyRulesMex, StockRulesMex } from '../stock.js'
import { TrackRulesMex } from '../track.js'
import { PhasesMex } from '../trains.js'
import { InfoMex } from './info.js'

export const TitleRulesMex: EighteenXXTitleRules<typeof StateMex, HydratedStateMex> = {
    state: StateDefinitionMex,
    endingRules: EndingRulesMex,
    names: NamesMex,
    auctionRules: AuctionRulesMex,
    trainFundingRules: TrainFundingRulesMex,
    transferRules: TransferRulesMex,
    privatePowerRules: PrivatePowerRulesMex,
    createOpening: createOpeningMex,
    startingCash: startingCashMex,
    currencySymbol: '$',
    stockRules: StockRulesMex,
    companyRules: CompanyRulesMex,
    operatingRules: OperatingRulesMex,
    trackRules: TrackRulesMex,
    stationRules: StationRulesMex,
    earningsRules: EarningsRulesMex,
    routeRules: RouteRulesMex,
    privateRules: PrivateRulesMex,
    phases: PhasesMex,
    phaseRules: PhaseRulesMex,
    trainRules: TrainRulesMex,
    decisionHandlers: {
        StockRound: (family) => clearsMailPaid(closesMinorsFirst(family)),
        StartingOperatingSet: clearsMailPaid,
        OperatingSet: clearsMailPaid,
        LayingTrack: collectsMailFirst
    },
    titleStateHandlers: { [MergingIntoNdmState]: MergingIntoNdmHandler },
    titleActions: [...MailActions, ...MergerActions, ...MinorActions],
    runInstructions: true
}

export const Definition: GameDefinition<StateMex, HydratedStateMex> = defineGame({
    info: InfoMex,
    runtime: createEighteenXXRuntime(TitleRulesMex)
})
