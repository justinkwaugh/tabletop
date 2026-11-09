import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    StepActionsHandler,
    SystemActionFirstHandler,
    clearsOnLeaving,
    createEighteenXXRuntime,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import { BuildActions, BuildSteps } from '../builds.js'
import { CompanyRules1862 } from '../companyRules.js'
import { PlaceHome, PlaceHomeDefinition, dueHome } from '../homes.js'
import { LnerActions, formsLner } from '../lner.js'
import { MergerActions, MergerStep, MergingSharesHandler, hostsMergers } from '../mergers.js'
import {
    FundingActions,
    FundingSteps,
    ReceivershipRules1862,
    bankruptsCompanies
} from '../trainFunding.js'
import { Names1862 } from '../names.js'
import { createOpening1862, startingCash1862 } from '../opening.js'
import {
    EarningsRules1862,
    EndingRules1862,
    OperatingRules1862,
    PhaseRules1862,
    PrivatePowerRules1862,
    PrivateRules1862,
    StationRules1862,
    TrainRules1862,
    TransferRules1862
} from '../operating.js'
import { ObligationActions, PayingFineHandler, enforcesObligations } from '../obligations.js'
import { ParliamentActions, ParliamentHandler, holdsParliament } from '../parliament.js'
import { RouteRules1862 } from '../routeRules.js'
import {
    BuyingStationsState,
    ParliamentState,
    PayingFineState,
    MergingSharesState,
    State1862,
    StateDefinition1862,
    type HydratedState1862,
    type StateHandler1862
} from '../state.js'
import { BuyStationsDefinition, BuyingStationsHandler, buysStations } from '../stationPurchase.js'
import { StockRules1862 } from '../stockRules.js'
import { TrackRules1862 } from '../trackRules.js'
import { Phases1862 } from '../trains.js'
import { WarrantyActions, WarrantyStep, expiresWarranties } from '../warranties.js'
import { Info1862 } from './info.js'

/** Places the operating company's home station as soon as it is due (§7.2). */
const placesHome = (handler: StateHandler1862, next?: string): StateHandler1862 =>
    new SystemActionFirstHandler(
        handler,
        PlaceHome,
        (state) => {
            const due = dueHome(state)
            return due ? { companyId: due.companyId } : undefined
        },
        next
    )

/** A company that went bankrupt in its own turn has ended it (§7.12). */
const endsBankruptTurn = (handler: StateHandler1862): StateHandler1862 => ({
    enter: (context) => handler.enter(context),
    isValidAction: (action, context) => handler.isValidAction(action, context),
    validActionsForPlayer: (playerId, context) => handler.validActionsForPlayer(playerId, context),
    onAction(action, context) {
        const next = handler.onAction(action, context)
        return next === 'BuyingTrains' && !context.gameState.trainPurchaseStep
            ? 'OperatingSet'
            : next
    }
})

/** Returns to the stock turn of the player whose purchase floated the company. */
function resumeStockRound(state: HydratedState1862): string {
    const turn = state.turnManager.currentTurn()
    if (turn) state.activePlayerIds = [turn.playerId]
    return 'StockRound'
}

export const TitleRules1862: EighteenXXTitleRules<typeof State1862, HydratedState1862> = {
    state: StateDefinition1862,
    endingRules: EndingRules1862,
    names: Names1862,
    createOpening: createOpening1862,
    startingCash: startingCash1862,
    currencySymbol: '£',
    stockRules: StockRules1862,
    companyRules: CompanyRules1862,
    operatingRules: OperatingRules1862,
    trackRules: TrackRules1862,
    stationRules: StationRules1862,
    earningsRules: EarningsRules1862,
    routeRules: RouteRules1862,
    trainRules: TrainRules1862,
    runInstructions: true,
    receivershipRules: ReceivershipRules1862,
    additionalConstructionActions: BuildSteps.map((step) => step.type),
    phases: Phases1862,
    phaseRules: PhaseRules1862,
    privateRules: PrivateRules1862,
    privatePowerRules: PrivatePowerRules1862,
    transferRules: TransferRules1862,
    decisionHandlers: {
        StockRound: (family) => bankruptsCompanies(buysStations(family)),
        StartingOperatingSet: (family) => enforcesObligations(family),
        OperatingSet: (family) =>
            bankruptsCompanies(formsLner(holdsParliament(placesHome(family)))),
        LayingTrack: (family) =>
            hostsMergers(new StepActionsHandler(placesHome(family), [...BuildSteps, MergerStep])),
        // A London link is the turn's station too, so the build lasts through the station step.
        PlacingStation: (family) =>
            clearsOnLeaving(family, 'PlacingStation', (state) => {
                delete state.build
            }),
        DistributingEarnings: (family) => expiresWarranties(family),
        BuyingTrains: (family) =>
            endsBankruptTurn(
                bankruptsCompanies(
                    hostsMergers(
                        clearsOnLeaving(
                            new StepActionsHandler(family, [
                                WarrantyStep,
                                ...FundingSteps,
                                MergerStep
                            ]),
                            'BuyingTrains',
                            (state) => {
                                delete state.redeemed
                                delete state.raisedForTrain
                            }
                        )
                    ),
                    // Another company's bankruptcy leaves the turn going; the buyer's own ends it.
                    (state) => (state.trainPurchaseStep ? 'BuyingTrains' : 'OperatingSet')
                )
            )
    },
    titleStateHandlers: {
        [ParliamentState]: new ParliamentHandler(),
        [BuyingStationsState]: new BuyingStationsHandler(resumeStockRound),
        [PayingFineState]: new PayingFineHandler(),
        [MergingSharesState]: new MergingSharesHandler()
    },
    titleActions: [
        ...ParliamentActions,
        ...ObligationActions,
        ...LnerActions,
        ...BuildActions,
        ...MergerActions,
        ...FundingActions,
        ...WarrantyActions,
        PlaceHomeDefinition,
        BuyStationsDefinition
    ]
}

export const Definition: GameDefinition<State1862, HydratedState1862> = defineGame({
    info: Info1862,
    runtime: createEighteenXXRuntime(TitleRules1862)
})
