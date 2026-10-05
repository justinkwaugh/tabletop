import { EndingRules1846 } from '../ending.js'
import {
    PublicDistributionActions,
    buyingOpeningCompaniesHandler,
    ResumeOpeningPurchases,
    ResumeOpeningPurchasesAction
} from '../publicDistribution.js'
import { endingActions, GameEndingHandler, FinalWealthScoring } from '@tabletop/18xx'
import {
    DeclareBankruptcy,
    DeclareBankruptcyAction,
    isDeclareBankruptcy1846,
    bankruptcyShortfall
} from '../bankruptcy.js'
import { inReceivership } from '../receivership.js'
import {
    BuyReceiverShare,
    BuyReceiverShareAction,
    BuyReceiverShareValidator,
    receiverShareChoices
} from '../receiverShares.js'
import {
    StartReceiverTurn,
    StartReceiverTurnAction,
    StartReceiverValidator,
    SettleReceiver,
    SettleReceiverAction,
    SettleReceiverValidator,
    BuyReceiverTrain,
    BuyReceiverTrainAction,
    BuyReceiverValidator,
    FinishReceiverTurn,
    FinishReceiverTurnAction,
    FinishReceiverValidator,
    settlingReceiverHandler,
    buyingReceiverHandler
} from '../receiverOperations.js'
import {
    SellEmergencyShares,
    SellEmergencySharesAction,
    isSellEmergencyShares,
    emergencyShareSaleChoices
} from '../emergencyFunding.js'
import {
    EmergencyBuyTrain,
    EmergencyBuyTrainAction,
    isEmergencyBuyTrain,
    emergencyTrainChoices,
    emergencyFundingStart,
    StartEmergencyFunding,
    StartEmergencyFundingAction,
    isStartEmergencyFunding
} from '../emergencyTrain.js'
import {
    BuildPrivateTrack,
    BuildPrivateTrackAction,
    isBuildPrivateTrack
} from '../privateConstruction.js'
import { PlaceCWIStation, PlaceCWIStationAction, isPlaceCWIStation } from '../privateStation.js'
import { PrivatePowersHandler } from '../privatePowersHandler.js'
import { PurchaseOffersHandler, transferActions } from '@tabletop/18xx'
import { TransferRules1846, AcquisitionSteps } from '../acquisitions.js'
import {
    AssignRevenueMarker,
    AssignRevenueMarkerValidator,
    AssignRevenueMarkerAction
} from '../revenueMarkers.js'
import {
    PhaseRules1846,
    AdvancePhase1846,
    AdvancePhase1846Action,
    isAdvancePhase1846,
    advancingPhase1846Handler
} from '../phases.js'
import { TrainRules1846 } from '../trains.js'
import {
    DiscardTrain,
    HydratedDiscardTrain,
    isDiscardTrain,
    DiscardingTrainsHandler,
    RustTrains,
    HydratedRustTrains,
    isRustTrains,
    RustingTrainsHandler,
    trainsRustingAfterOperation,
    BuyTrain,
    isBuyTrain,
    HydratedBuyTrain,
    OrdinaryBuyingTrainsHandler,
    StartStockRound,
    HydratedStartStockRound,
    canStartStockRound,
    BetweenCompaniesState,
    FinishOperatingTurn,
    isFinishOperatingTurn,
    HydratedFinishOperatingTurn
} from '@tabletop/18xx'
import { EarningsRules1846 } from '../earnings.js'
import { earningsActions, DistributingEarningsHandler, endOperatingTurn } from '@tabletop/18xx'
import { StationRules1846, stationChoices1846 } from '../stations.js'
import {
    PlaceStation,
    isPlaceStation,
    HydratedPlaceStation,
    StationPlacement,
    FinishStations,
    isFinishStations,
    HydratedFinishStations
} from '@tabletop/18xx'
import {
    CorporateFinance,
    CorporateFinanceValidator,
    CorporateFinanceAction
} from '../corporateFinance.js'
import { getCompany } from '@tabletop/18xx'
import { RunTrains, isRunTrains, HydratedRunTrains, RunningTrainsHandler } from '@tabletop/18xx'
import { RouteRules1846 } from '../routes.js'
import {
    AssignSteamboat,
    AssignSteamboatValidator,
    AssignSteamboatAction,
    steamboatOwner
} from '../steamboat.js'
import {
    SettleIndependent,
    SettleIndependentValidator,
    SettleIndependentAction
} from '../settleIndependent.js'
import {
    defineAction,
    StartOperatingSet,
    isStartOperatingSet,
    HydratedStartOperatingSet,
    StartOperatingSetHandler,
    StartOperatingRound,
    isStartOperatingRound,
    HydratedStartOperatingRound,
    StartOperatingTurn,
    isStartOperatingTurn,
    HydratedStartOperatingTurn,
    nextOperatingCompany,
    canStartOperatingRound,
    LayingTrackHandler,
    LayTile,
    isLayTile,
    HydratedLayTile,
    FinishTrack,
    isFinishTrack,
    HydratedFinishTrack
} from '@tabletop/18xx'
import { OperatingRules1846, ValuationRules1846, nextOperatingState1846 } from '../operating.js'
import { TrackRules1846 } from '../track.js'
import {
    CloseCorporation,
    CloseCorporationValidator,
    CloseCorporationAction,
    corporationAwaitingClosure,
    corporationClosureHandler
} from '../closeCorporation.js'
import {
    ActionRegistry,
    stockActions,
    companyActions,
    OrdinaryStockRoundHandler
} from '@tabletop/18xx'
import { StockRules1846, CompanyRules1846 } from '../stock.js'
import {
    ActionSource,
    assert,
    assertExists,
    Visibility,
    type GameDefinition,
    type GameRuntime
} from '@tabletop/common'
import {
    EighteenFortySixState,
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState,
    CanonicalValidator
} from '../state.js'
import { Initializer, PlayerColors } from '../setup.js'
import {
    ChooseDraftCard,
    PassFinalCompany,
    RevealDraft,
    ChooseValidator,
    PassValidator,
    RevealValidator,
    ChooseAction,
    PassAction,
    RevealAction
} from '../actions.js'
import { choicesFor, hiddenDistribution } from '../distribution.js'
import { EighteenFortySixInfo } from './info.js'

const actionRegistry = new ActionRegistry([
    ...PublicDistributionActions,
    ...endingActions(EndingRules1846),
    defineAction(
        DeclareBankruptcy,
        isDeclareBankruptcy1846,
        (data) => new DeclareBankruptcyAction(data)
    ),
    defineAction(
        StartEmergencyFunding,
        isStartEmergencyFunding,
        (data) => new StartEmergencyFundingAction(data)
    ),
    defineAction(
        SellEmergencyShares,
        isSellEmergencyShares,
        (data) => new SellEmergencySharesAction(data)
    ),
    defineAction(
        EmergencyBuyTrain,
        isEmergencyBuyTrain,
        (data) => new EmergencyBuyTrainAction(data)
    ),
    defineAction(
        BuildPrivateTrack,
        isBuildPrivateTrack,
        (data) => new BuildPrivateTrackAction(data)
    ),
    defineAction(PlaceCWIStation, isPlaceCWIStation, (data) => new PlaceCWIStationAction(data)),
    ...transferActions(TransferRules1846, TrainRules1846, StockRules1846, true),
    defineAction(AdvancePhase1846, isAdvancePhase1846, (data) => new AdvancePhase1846Action(data)),
    defineAction(
        DiscardTrain,
        isDiscardTrain,
        (data) => new HydratedDiscardTrain(data, TrainRules1846, PhaseRules1846)
    ),
    defineAction(RustTrains, isRustTrains, (data) => new HydratedRustTrains(data, TrainRules1846)),
    defineAction(BuyTrain, isBuyTrain, (data) => new HydratedBuyTrain(data, TrainRules1846)),
    defineAction(
        FinishOperatingTurn,
        isFinishOperatingTurn,
        (data) => new HydratedFinishOperatingTurn(data, TrainRules1846, ValuationRules1846)
    ),
    ...earningsActions(
        EarningsRules1846,
        { operationEffects: () => [] },
        StockRules1846,
        'BuyingTrains'
    ),
    defineAction(
        PlaceStation,
        isPlaceStation,
        (data) => new HydratedPlaceStation(data, StationRules1846)
    ),
    defineAction(FinishStations, isFinishStations, (data) => new HydratedFinishStations(data)),
    defineAction(RunTrains, isRunTrains, (data) => new HydratedRunTrains(data, RouteRules1846)),
    defineAction(
        StartOperatingSet,
        isStartOperatingSet,
        (data) => new HydratedStartOperatingSet(data, OperatingRules1846)
    ),
    defineAction(
        StartOperatingRound,
        isStartOperatingRound,
        (data) => new HydratedStartOperatingRound(data, OperatingRules1846, ValuationRules1846)
    ),
    defineAction(
        StartOperatingTurn,
        isStartOperatingTurn,
        (data) => new HydratedStartOperatingTurn(data)
    ),
    defineAction(LayTile, isLayTile, (data) => new HydratedLayTile(data, TrackRules1846)),
    defineAction(FinishTrack, isFinishTrack, (data) => new HydratedFinishTrack(data)),
    ...stockActions(StockRules1846),
    ...companyActions(CompanyRules1846, StockRules1846)
])
const stockHandler = new OrdinaryStockRoundHandler(
    StockRules1846,
    'PreparingOperatingSet',
    CompanyRules1846
)
const buyingTrains = new OrdinaryBuyingTrainsHandler(TrainRules1846, BetweenCompaniesState)
const rustingTrains = new RustingTrainsHandler('DistributingEarnings')
const runningTrains = new RunningTrainsHandler(RouteRules1846, 'DistributingEarnings')
const distributingEarnings = new DistributingEarningsHandler(EarningsRules1846, 'BuyingTrains')
const layingTrack = new LayingTrackHandler(TrackRules1846, 'RunningTrains')
const apiActions = {
    StartReceiverTurn,
    SettleReceiver,
    BuyReceiverTrain,
    FinishReceiverTurn,
    BuyReceiverShare,
    ChooseDraftCard,
    PassFinalCompany,
    RevealDraft,
    CloseCorporation,
    AssignSteamboat,
    SettleIndependent,
    CorporateFinance,
    AssignRevenueMarker,
    ...actionRegistry.schemas
}
export const Runtime: GameRuntime<EighteenFortySixProjectedState, HydratedEighteenFortySixState> = {
    randomnessVersion: 1,
    initializer: new Initializer(),
    playerColors: PlayerColors,
    apiActions,
    canonicalStateValidator: CanonicalValidator,
    scoring: FinalWealthScoring,
    hydrator: {
        hydrateState: (data) =>
            new HydratedEighteenFortySixState(
                data instanceof HydratedEighteenFortySixState ? data.dehydrate() : data
            ),
        hydrateAction(data) {
            if (StartReceiverValidator.Check(data)) return new StartReceiverTurnAction(data)
            if (SettleReceiverValidator.Check(data)) return new SettleReceiverAction(data)
            if (BuyReceiverValidator.Check(data)) return new BuyReceiverTrainAction(data)
            if (FinishReceiverValidator.Check(data)) return new FinishReceiverTurnAction(data)
            if (BuyReceiverShareValidator.Check(data)) return new BuyReceiverShareAction(data)
            if (AssignRevenueMarkerValidator.Check(data)) return new AssignRevenueMarkerAction(data)
            if (CorporateFinanceValidator.Check(data)) return new CorporateFinanceAction(data)
            if (ChooseValidator.Check(data)) return new ChooseAction(data)
            if (PassValidator.Check(data)) return new PassAction(data)
            if (RevealValidator.Check(data)) return new RevealAction(data)
            if (CloseCorporationValidator.Check(data)) return new CloseCorporationAction(data)
            if (AssignSteamboatValidator.Check(data)) return new AssignSteamboatAction(data)
            if (SettleIndependentValidator.Check(data)) return new SettleIndependentAction(data)
            const stockAction = actionRegistry.hydrate(data)
            if (stockAction) return stockAction
            throw Error('Unknown or invalid 1846 action')
        }
    },
    visibility: {
        state: Visibility.createProjector(EighteenFortySixState),
        actions: Visibility.createActionProjector(apiActions)
    },
    stateHandlers: {
        BuyingOpeningCompanies: buyingOpeningCompaniesHandler,
        Drafting: {
            enter() {},
            validActionsForPlayer(playerId, { gameState }) {
                if (!gameState.isActivePlayer(playerId)) return []
                return [
                    ...(choicesFor(gameState, playerId).length ? ['ChooseDraftCard'] : []),
                    ...(hiddenDistribution(gameState).finalOffer ? ['PassFinalCompany'] : [])
                ]
            },
            isValidAction(action, { gameState }) {
                return (
                    (action instanceof ChooseAction &&
                        choicesFor(gameState, action.playerId).includes(action.cardId)) ||
                    (action instanceof PassAction &&
                        gameState.isActivePlayer(action.playerId) &&
                        hiddenDistribution(gameState).finalOffer !== undefined)
                )
            },
            onAction(_action, { gameState }) {
                return gameState.machineState
            }
        },
        RevealingDraft: {
            enter(context) {
                context.addSystemAction(RevealDraft)
            },
            validActionsForPlayer() {
                return []
            },
            isValidAction(action) {
                return action instanceof RevealAction
            },
            onAction() {
                return 'StockRound'
            }
        },
        StockRound: {
            enter(context) {
                const companyId = corporationAwaitingClosure(context.gameState)
                if (companyId) context.addSystemAction(CloseCorporation, { companyId })
                else stockHandler.enter(context)
            },
            validActionsForPlayer: (playerId, context) =>
                corporationAwaitingClosure(context.gameState)
                    ? []
                    : [
                          ...stockHandler.validActionsForPlayer(playerId, context),
                          ...(receiverShareChoices(context.gameState, playerId).length
                              ? ['BuyReceiverShare']
                              : [])
                      ],
            isValidAction(action, context) {
                const companyId = corporationAwaitingClosure(context.gameState)
                return companyId
                    ? corporationClosureHandler.isValidAction(action, context)
                    : action instanceof BuyReceiverShareAction
                      ? action.isValid(context.gameState)
                      : stockHandler.isValidAction(action, context)
            },
            onAction(_action, context) {
                if (
                    context.gameState.stockRound.completed &&
                    !corporationAwaitingClosure(context.gameState)
                ) {
                    context.gameState.priorityDealPlayerId =
                        context.gameState.turnManager.turnOrder[0]
                    context.gameState.activePlayerIds = []
                    return 'PreparingOperatingSet'
                }
                return 'StockRound'
            }
        },
        PreparingOperatingSet: new StartOperatingSetHandler('StartingOperatingRound'),
        StartingOperatingRound: {
            enter(context) {
                context.addSystemAction(StartOperatingRound)
            },
            validActionsForPlayer() {
                return []
            },
            isValidAction(action, { gameState }) {
                return (
                    action.source === ActionSource.System &&
                    action instanceof HydratedStartOperatingRound &&
                    canStartOperatingRound(gameState)
                )
            },
            onAction(_action, { gameState }) {
                return steamboatOwner(gameState)
                    ? 'AssigningSteamboat'
                    : nextOperatingState1846(gameState)
            }
        },
        AssigningSteamboat: {
            enter({ gameState }) {
                const owner = steamboatOwner(gameState)
                assertExists(owner, 'Steamboat assignment requires its player owner')
                gameState.activePlayerIds = [owner]
            },
            validActionsForPlayer(playerId, { gameState }) {
                return gameState.isActivePlayer(playerId) ? ['AssignSteamboat'] : []
            },
            isValidAction(action, { gameState }) {
                return action instanceof AssignSteamboatAction && action.isValid(gameState)
            },
            onAction(_action, { gameState }) {
                return nextOperatingState1846(gameState)
            }
        },
        StartingOperatingTurn: {
            enter(context) {
                const companyId = nextOperatingCompany(context.gameState)
                assertExists(companyId, 'An operating turn requires a company')
                if (inReceivership(context.gameState, companyId))
                    context.addSystemAction(StartReceiverTurn, { companyId })
                else context.addSystemAction(StartOperatingTurn, { companyId })
            },
            validActionsForPlayer() {
                return []
            },
            isValidAction(action, { gameState }) {
                return (
                    action.source === ActionSource.System &&
                    (action instanceof HydratedStartOperatingTurn ||
                        action instanceof StartReceiverTurnAction) &&
                    action.companyId === nextOperatingCompany(gameState)
                )
            },
            onAction(_action, { gameState }) {
                const companyId = nextOperatingCompany(gameState)
                assertExists(companyId, 'An operating turn requires a company')
                if (inReceivership(gameState, companyId)) return 'RunningReceiver'
                return getCompany(gameState, companyId).kind === 'major'
                    ? 'CorporateFinance'
                    : 'LayingTrack'
            }
        },
        LayingTrack: {
            enter(context) {
                layingTrack.enter(context)
                const state = context.gameState
                const companyId = state.trackStep?.companyId
                assertExists(companyId, 'Construction requires an operating company')
                if (getCompany(state, companyId).kind !== 'major') return
                state.stationStep ??= { companyId, placedStationIds: [], completed: false }
                if (state.trackStep?.completed)
                    context.addSystemAction(FinishStations, {
                        companyId,
                        playerId: state.activePlayerIds[0]
                    })
            },
            validActionsForPlayer(id, context) {
                return [
                    ...layingTrack.validActionsForPlayer(id, context),
                    ...(context.gameState.isActivePlayer(id) &&
                    stationChoices1846(context.gameState).length
                        ? ['PlaceStation']
                        : [])
                ]
            },
            isValidAction(action, context) {
                const state = context.gameState
                if (isFinishStations(action))
                    return (
                        action.source === ActionSource.System &&
                        !!state.trackStep?.completed &&
                        state.stationStep?.companyId === action.companyId &&
                        !state.stationStep.completed &&
                        state.isActivePlayer(action.playerId)
                    )
                if (!isPlaceStation(action)) return layingTrack.isValidAction(action, context)
                const placement = new StationPlacement(state, StationRules1846)
                return (
                    action.source === ActionSource.User &&
                    state.isActivePlayer(action.playerId) &&
                    placement.canAct(action.playerId, action.companyId) &&
                    placement.evaluate(action).details?.cost === action.expectedCost
                )
            },
            onAction(action, { gameState }) {
                if (isFinishStations(action)) return 'RunningTrains'
                if (isFinishTrack(action) && !gameState.stationStep) return 'RunningTrains'
                return 'LayingTrack'
            }
        },
        RunningReceiver: new RunningTrainsHandler(RouteRules1846, 'SettlingReceiver'),
        SettlingReceiver: settlingReceiverHandler,
        BuyingReceiverTrain: buyingReceiverHandler,
        FinishingReceiverTurn: buyingReceiverHandler,
        GameOver: {
            enter() {},
            validActionsForPlayer: () => [],
            isValidAction: () => false,
            onAction: () => 'GameOver'
        },
        RunningTrains: {
            enter: (context) => runningTrains.enter(context),
            validActionsForPlayer: (id, context) =>
                runningTrains.validActionsForPlayer(id, context),
            isValidAction: (action, context) => runningTrains.isValidAction(action, context),
            onAction(_action, { gameState }) {
                const companyId = gameState.routeStep?.companyId
                assertExists(companyId, 'A train run requires an operating company')
                if (trainsRustingAfterOperation(gameState, companyId).length) return 'RustingTrains'
                return getCompany(gameState, companyId).kind === 'minor'
                    ? 'SettlingIndependent'
                    : 'DistributingEarnings'
            }
        },
        DistributingEarnings: {
            enter: (context) => distributingEarnings.enter(context),
            validActionsForPlayer: (id, context) =>
                distributingEarnings.validActionsForPlayer(id, context),
            isValidAction: (action, context) => distributingEarnings.isValidAction(action, context),
            onAction(_action, { gameState }) {
                return corporationAwaitingClosure(gameState)
                    ? 'ClosingOperatingCorporation'
                    : 'BuyingTrains'
            }
        },
        ClosingOperatingCorporation: {
            ...corporationClosureHandler,
            onAction(action, { gameState }) {
                assert(
                    action instanceof CloseCorporationAction,
                    'Closure requires its system action'
                )
                endOperatingTurn(gameState, action.companyId)
                gameState.activePlayerIds = []
                return nextOperatingState1846(gameState)
            }
        },
        SettlingIndependent: {
            enter(context) {
                const companyId = nextOperatingCompany(context.gameState)
                assertExists(companyId, 'Settlement requires an independent')
                context.addSystemAction(SettleIndependent, { companyId })
            },
            validActionsForPlayer() {
                return []
            },
            isValidAction(action, { gameState }) {
                return (
                    action instanceof SettleIndependentAction &&
                    action.source === ActionSource.System &&
                    action.companyId === nextOperatingCompany(gameState)
                )
            },
            onAction(_action, { gameState }) {
                return nextOperatingState1846(gameState)
            }
        },
        CorporateFinance: {
            enter() {},
            validActionsForPlayer(playerId, { gameState }) {
                return gameState.isActivePlayer(playerId) ? ['CorporateFinance'] : []
            },
            isValidAction(action, { gameState }) {
                return action instanceof CorporateFinanceAction && action.isValid(gameState)
            },
            onAction() {
                return 'LayingTrack'
            }
        },
        BuyingTrains: {
            enter: (context) => buyingTrains.enter(context),
            validActionsForPlayer: (id, context) => [
                ...buyingTrains.validActionsForPlayer(id, context),
                ...(context.gameState.activePlayerIds.includes(id) &&
                emergencyTrainChoices(context.gameState).length
                    ? ['EmergencyBuyTrain']
                    : []),
                ...(context.gameState.activePlayerIds.includes(id) &&
                emergencyFundingStart(context.gameState)
                    ? ['StartEmergencyFunding']
                    : [])
            ],
            isValidAction: (action, context) =>
                action instanceof EmergencyBuyTrainAction ||
                action instanceof StartEmergencyFundingAction
                    ? action.isValid(context.gameState)
                    : buyingTrains.isValidAction(action, context),
            onAction(action, { gameState }) {
                if (gameState.emergencyFunding) return 'FundingTrain'
                if (gameState.phaseChange) {
                    return 'AdvancingPhase'
                }
                if (!isFinishOperatingTurn(action)) return 'BuyingTrains'
                gameState.activePlayerIds = []
                return nextOperatingState1846(gameState)
            }
        },
        FundingTrain: {
            enter() {},
            validActionsForPlayer(id, { gameState }) {
                if (!gameState.activePlayerIds.includes(id)) return []
                return [
                    ...(bankruptcyShortfall(gameState) !== undefined
                        ? ['DeclareBankruptcy1846']
                        : []),
                    ...(emergencyTrainChoices(gameState).length ? ['EmergencyBuyTrain'] : []),
                    ...(emergencyShareSaleChoices(gameState).length ? ['SellEmergencyShares'] : [])
                ]
            },
            isValidAction(action, { gameState }) {
                return (
                    (action instanceof EmergencyBuyTrainAction ||
                        action instanceof SellEmergencySharesAction ||
                        action instanceof DeclareBankruptcyAction) &&
                    action.isValid(gameState)
                )
            },
            onAction(_action, { gameState }) {
                if (gameState.result) return 'GameOver'
                if (
                    !gameState.emergencyFunding &&
                    gameState.trainPurchaseStep &&
                    inReceivership(gameState, gameState.trainPurchaseStep.companyId)
                )
                    return 'BuyingReceiverTrain'
                if (corporationAwaitingClosure(gameState)) return 'ClosingFundingCorporation'
                if (gameState.phaseChange) return 'AdvancingPhase'
                return gameState.emergencyFunding ? 'FundingTrain' : 'BuyingTrains'
            }
        },
        ClosingFundingCorporation: {
            ...corporationClosureHandler,
            onAction(_action, { gameState }) {
                return corporationAwaitingClosure(gameState)
                    ? 'ClosingFundingCorporation'
                    : 'FundingTrain'
            }
        },
        AdvancingPhase: advancingPhase1846Handler,
        DiscardingTrains: new DiscardingTrainsHandler(TrainRules1846, PhaseRules1846),
        RustingTrains: {
            enter: (context) => rustingTrains.enter(context),
            validActionsForPlayer: () => [],
            isValidAction: (action, context) => rustingTrains.isValidAction(action, context),
            onAction(_action, { gameState }) {
                const companyId = gameState.routeStep?.companyId
                assertExists(companyId, 'Rusting requires an operating company')
                return inReceivership(gameState, companyId)
                    ? 'SettlingReceiver'
                    : 'DistributingEarnings'
            }
        },
        OperatingSet: {
            enter(context) {
                if (
                    context.gameState.draft.kind === 'public' &&
                    context.gameState.draft.stage === 'operating'
                )
                    context.addSystemAction(ResumeOpeningPurchases)
                else context.addSystemAction(StartStockRound)
            },
            validActionsForPlayer() {
                return []
            },
            isValidAction(action, { gameState }) {
                if (gameState.draft.kind === 'public' && gameState.draft.stage === 'operating')
                    return (
                        action instanceof ResumeOpeningPurchasesAction && action.isValid(gameState)
                    )
                return (
                    action.source === ActionSource.System &&
                    action instanceof HydratedStartStockRound &&
                    canStartStockRound(gameState)
                )
            },
            onAction(action) {
                return action instanceof ResumeOpeningPurchasesAction
                    ? 'BuyingOpeningCompanies'
                    : 'StockRound'
            }
        }
    }
}
for (const step of AcquisitionSteps) {
    const handler = Runtime.stateHandlers[step]
    assertExists(handler, 'A purchase window has an operating handler')
    Runtime.stateHandlers[step] = new PurchaseOffersHandler(
        new PrivatePowersHandler(handler),
        TransferRules1846,
        TrainRules1846
    )
}
for (const [step, handler] of Object.entries(Runtime.stateHandlers)) {
    if (step !== 'GameOver')
        Runtime.stateHandlers[step] = new GameEndingHandler(handler, EndingRules1846)
}
export const Definition: GameDefinition<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = { info: EighteenFortySixInfo, runtime: Runtime }
