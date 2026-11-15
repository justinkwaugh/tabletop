import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    StepActionsHandler,
    createEighteenXXRuntime,
    type EighteenXXMachineState,
    type EighteenXXStateHandler,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import { CentralActions1882, ConvertCentralStep } from '../central.js'
import { Names1882 } from '../names.js'
import { MoveRebellionStationStep, RebellionMoveActions1882, RebellionMoveStates } from '../nwr.js'
import { AuctionRules1882, createOpening1882, startingCash1882 } from '../opening.js'
import {
    EarningsRules1882,
    EndingRules1882,
    OperatingRules1882,
    PhaseRules1882,
    PrivateRules1882,
    TrainFundingRules1882,
    TransferRules1882
} from '../operating.js'
import { PrivatePowerRules1882 } from '../privatePowers.js'
import { RebellionActions1882, RebellionStates, rebels } from '../rebellion.js'
import { RouteRules1882 } from '../routes.js'
import { State1882, StateDefinition1882, type HydratedState1882 } from '../state.js'
import { StationRules1882 } from '../stations.js'
import { CompanyRules1882, StockRules1882 } from '../stock.js'
import { TrackRules1882 } from '../track.js'
import { Phases1882, TrainRules1882 } from '../trains.js'
import { Info1882 } from './info.js'

type Handler = EighteenXXStateHandler<HydratedState1882>

function decisionHandlers(): Partial<Record<EighteenXXMachineState, (family: Handler) => Handler>> {
    const states = new Set([...RebellionMoveStates, ...RebellionStates, 'StockRound' as const])
    return Object.fromEntries(
        [...states].map((machineState) => [
            machineState,
            (family: Handler) => {
                let handler = family
                if (machineState === 'StockRound')
                    handler = new StepActionsHandler(handler, [ConvertCentralStep])
                if (RebellionMoveStates.includes(machineState))
                    handler = new StepActionsHandler(handler, [MoveRebellionStationStep])
                return RebellionStates.includes(machineState) ? rebels(handler) : handler
            }
        ])
    )
}

export const TitleRules1882: EighteenXXTitleRules<typeof State1882, HydratedState1882> = {
    state: StateDefinition1882,
    endingRules: EndingRules1882,
    names: Names1882,
    auctionRules: AuctionRules1882,
    trainFundingRules: TrainFundingRules1882,
    transferRules: TransferRules1882,
    privatePowerRules: PrivatePowerRules1882,
    createOpening: createOpening1882,
    startingCash: startingCash1882,
    currencySymbol: '$',
    stockRules: StockRules1882,
    companyRules: CompanyRules1882,
    operatingRules: OperatingRules1882,
    trackRules: TrackRules1882,
    stationRules: StationRules1882,
    earningsRules: EarningsRules1882,
    routeRules: RouteRules1882,
    privateRules: PrivateRules1882,
    phases: Phases1882,
    phaseRules: PhaseRules1882,
    trainRules: TrainRules1882,
    runInstructions: true,
    decisionHandlers: decisionHandlers(),
    titleActions: [...CentralActions1882, ...RebellionMoveActions1882, ...RebellionActions1882]
}

export const Definition: GameDefinition<State1882, HydratedState1882> = defineGame({
    info: Info1882,
    runtime: createEighteenXXRuntime(TitleRules1882)
})
