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
import { OperatingRules1846, ValuationRules1846 } from '../operating.js'
import { TrackRules1846 } from '../track.js'
import {
    CloseCorporation,
    CloseCorporationValidator,
    CloseCorporationAction,
    corporationAwaitingClosure
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
import { choicesFor } from '../distribution.js'
import { EighteenFortySixInfo } from './info.js'

const stockRegistry = new ActionRegistry([
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
const layingTrack = new LayingTrackHandler(TrackRules1846, 'ReadyForRoutes')
const apiActions = {
    ChooseDraftCard,
    PassFinalCompany,
    RevealDraft,
    CloseCorporation,
    ...stockRegistry.schemas
}
export const Runtime: GameRuntime<EighteenFortySixProjectedState, HydratedEighteenFortySixState> = {
    randomnessVersion: 1,
    initializer: new Initializer(),
    playerColors: PlayerColors,
    apiActions,
    canonicalStateValidator: CanonicalValidator,
    hydrator: {
        hydrateState: (data) => new HydratedEighteenFortySixState(data),
        hydrateAction(data) {
            if (ChooseValidator.Check(data)) return new ChooseAction(data)
            if (PassValidator.Check(data)) return new PassAction(data)
            if (RevealValidator.Check(data)) return new RevealAction(data)
            if (CloseCorporationValidator.Check(data)) return new CloseCorporationAction(data)
            const stockAction = stockRegistry.hydrate(data)
            if (stockAction) return stockAction
            throw Error('Unknown or invalid 1846 action')
        }
    },
    visibility: {
        state: Visibility.createProjector(EighteenFortySixState),
        actions: Visibility.createActionProjector(apiActions)
    },
    stateHandlers: {
        Drafting: {
            enter() {},
            validActionsForPlayer(playerId, { gameState }) {
                if (!gameState.isActivePlayer(playerId)) return []
                return [
                    ...(choicesFor(gameState, playerId).length ? ['ChooseDraftCard'] : []),
                    ...(gameState.draft.finalOffer ? ['PassFinalCompany'] : [])
                ]
            },
            isValidAction(action, { gameState }) {
                return (
                    (action instanceof ChooseAction &&
                        choicesFor(gameState, action.playerId).includes(action.cardId)) ||
                    (action instanceof PassAction &&
                        gameState.isActivePlayer(action.playerId) &&
                        gameState.draft.finalOffer !== undefined)
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
                    : stockHandler.validActionsForPlayer(playerId, context),
            isValidAction(action, context) {
                const companyId = corporationAwaitingClosure(context.gameState)
                return companyId
                    ? action instanceof CloseCorporationAction && action.companyId === companyId
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
            onAction() {
                return 'StartingOperatingTurn'
            }
        },
        StartingOperatingTurn: {
            enter(context) {
                const companyId = nextOperatingCompany(context.gameState)
                assertExists(
                    companyId,
                    'The opening operating round starts with an independent railroad'
                )
                context.addSystemAction(StartOperatingTurn, { companyId })
            },
            validActionsForPlayer() {
                return []
            },
            isValidAction(action, { gameState }) {
                return (
                    action.source === ActionSource.System &&
                    action instanceof HydratedStartOperatingTurn &&
                    action.companyId === nextOperatingCompany(gameState)
                )
            },
            onAction() {
                return 'LayingTrack'
            }
        },
        LayingTrack: {
            enter: (context) => layingTrack.enter(context),
            validActionsForPlayer: (id, context) => layingTrack.validActionsForPlayer(id, context),
            isValidAction: (action, context) => layingTrack.isValidAction(action, context),
            onAction: (action) => (isFinishTrack(action) ? 'ReadyForRoutes' : 'LayingTrack')
        },
        ReadyForRoutes: {
            enter() {},
            validActionsForPlayer() {
                return []
            },
            isValidAction() {
                return false
            },
            onAction() {
                return 'ReadyForRoutes'
            }
        }
    }
}
export const Definition: GameDefinition<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = { info: EighteenFortySixInfo, runtime: Runtime }
