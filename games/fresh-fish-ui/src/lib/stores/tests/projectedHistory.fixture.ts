import {
    ActionSource,
    GameNotificationAction,
    GameSyncStatus,
    NotificationCategory,
    assertExists,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    NotificationChannel,
    NotificationEventType,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import { FreshFishRuntime } from '@tabletop/fresh-fish'
import { tick } from 'svelte'
import { FreshFishUiRuntime } from '../../definition/gameUiRuntime.js'
import { UiDefinition } from '../../index.js'
import { FreshFishGameSession } from '../FreshFishGameSession.svelte.js'
import {
    GAME_ID,
    PLAYER_A_ID,
    PLAYER_B_ID,
    PLAYER_B_PERSPECTIVE,
    PLAYER_C_ID,
    PLAYER_D_ID,
    type CanonicalHost,
    createAuctionHost,
    createBid,
    projectHostHistory,
    projectHostHistorySuffix
} from './simultaneousAuction.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('The metadata-only test definition has no runtime')
    }
}

function normalizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item))
    }
    if (value instanceof Date) {
        return value.toISOString()
    }
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, normalizeValue(Reflect.get(value, key))])
        )
    }
    return value
}

function valuesMatch(first: unknown, second: unknown): boolean {
    return JSON.stringify(normalizeValue(first)) === JSON.stringify(normalizeValue(second))
}

function describeFirstDifference(actual: unknown, expected: unknown) {
    const actualText = JSON.stringify(normalizeValue(actual))
    const expectedText = JSON.stringify(normalizeValue(expected))
    let index = 0
    while (
        index < actualText.length &&
        index < expectedText.length &&
        actualText[index] === expectedText[index]
    ) {
        index += 1
    }
    const start = Math.max(0, index - 100)
    const end = index + 300
    return {
        index,
        actual: actualText.slice(start, end),
        expected: expectedText.slice(start, end)
    }
}

async function waitUntilHistoryIsEnabled(session: FreshFishGameSession): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        await tick()
        if (!session.history.isDisabled()) {
            return
        }
        await new Promise<void>((resolve) => setTimeout(resolve))
    }
    throw new Error('History did not become enabled')
}

function createHistoryClient(host: CanonicalHost, projected = true) {
    const projectedHistory = projectHostHistory(host, projected ? PLAYER_B_PERSPECTIVE : undefined)
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME_ID
    })
    const session = new FreshFishGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: projected ? FreshFishUiRuntime : { ...FreshFishUiRuntime, visibility: undefined },
        game: structuredClone(host.game),
        state: projectedHistory.currentState,
        actions: [...projectedHistory.actions]
    })

    return { appContext, bridgedContext, session }
}

export async function runProjectedHistoryRoundTrip() {
    const host = createAuctionHost()
    const canonicalBeforeAuction = structuredClone(host.state)

    host.apply(createBid('bid-a-01', PLAYER_A_ID, 7))
    host.apply(createBid('bid-d-02', PLAYER_D_ID, 3))
    host.apply(createBid('bid-b-03', PLAYER_B_ID, 2))
    host.apply(createBid('bid-c-04', PLAYER_C_ID, 4))

    const hiddenTile = host.state.tileBag.items[0]
    assertExists(hiddenTile, 'Expected a hidden Tile in the canonical bag')
    Reflect.set(hiddenTile, 'testMarker', 'canonical-hidden-tile')

    const projectedBeforeAuction = FreshFishRuntime.visibility.state.project(
        canonicalBeforeAuction,
        PLAYER_B_PERSPECTIVE
    )
    const { bridgedContext, session } = createHistoryClient(host)

    try {
        await session.waitForVisibleTransitionSettled()
        await waitUntilHistoryIsEnabled(session)
        const projectedAfterAuction = structuredClone(session.history.visibleContext.state)
        const iterations = []

        for (let iteration = 0; iteration < 3; iteration += 1) {
            await session.history.goToPreviousAction()
            await tick()
            await session.waitForVisibleTransitionSettled()

            const backwardContext = session.history.visibleContext
            const stateMatches = valuesMatch(backwardContext.state, projectedBeforeAuction)
            const backward = {
                inHistory: session.history.inHistory,
                actionIndex: session.history.actionIndex,
                stateMatches,
                difference: stateMatches
                    ? undefined
                    : describeFirstDifference(backwardContext.state, projectedBeforeAuction),
                containsCanonicalTile:
                    JSON.stringify(backwardContext).includes('canonical-hidden-tile')
            }

            await new Promise<void>((resolve) => setTimeout(resolve))
            await session.history.goToNextAction()
            await tick()
            await session.waitForVisibleTransitionSettled()

            const forwardContext = session.history.visibleContext
            const forward = {
                inHistory: session.history.inHistory,
                stateMatches: valuesMatch(forwardContext.state, projectedAfterAuction),
                containsCanonicalTile:
                    JSON.stringify(forwardContext).includes('canonical-hidden-tile')
            }
            iterations.push({ backward, forward })

            await new Promise<void>((resolve) => setTimeout(resolve))
        }

        return {
            iterations,
            canonicalStillContainsHiddenTile: JSON.stringify(host.state).includes(
                'canonical-hidden-tile'
            )
        }
    } finally {
        session.dispose()
        bridgedContext.dispose()
    }
}

export async function runBusyUndo(
    busyReason: 'processing' | 'presentation',
    recovery: 'none' | 'corruptReplay' | 'discontinuity' = 'none',
    projected = true
) {
    const host = createAuctionHost()
    const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
    host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
    const { appContext, bridgedContext, session } = createHistoryClient(host, projected)
    let syncRequests = 0
    appContext.api.checkSync = async () => {
        syncRequests += 1
        const history = projectHostHistory(host, projected ? PLAYER_B_PERSPECTIVE : undefined)
        return {
            status: GameSyncStatus.OutOfSync,
            actions: [...history.actions],
            checksum: host.state.actionChecksum
        }
    }
    appContext.api.getGame = async () => {
        const history = projectHostHistory(host, projected ? PLAYER_B_PERSPECTIVE : undefined)
        return {
            game: { ...host.gameWithoutState(), state: history.currentState },
            actions: [...history.actions]
        }
    }
    let releasePresentation = () => {}
    const presentation = new Promise<void>((resolve) => {
        releasePresentation = resolve
    })
    session.listenToGame()
    try {
        await session.waitForVisibleTransitionSettled()
        await waitUntilHistoryIsEnabled(session)
        let initialChecksum = session.history.visibleContext.state.actionChecksum
        if (busyReason === 'processing') {
            session.processingActions = true
        } else {
            session.addGameStateChangeListener(async () => {
                await presentation
            })
        }
        await tick()
        let busyDuringDelivery = session.busy
        for (const step of projected
            ? ['add-before', 'undo', 'add-after']
            : ['add-before', 'undo']) {
            if (step === 'undo') {
                const result = host.undo(aBid.id)
                const history = projectHostHistorySuffix(
                    host,
                    result.actionReplay.startIndex,
                    PLAYER_B_PERSPECTIVE
                )
                await appContext.notificationService.emit({
                    eventType: NotificationEventType.Data,
                    channel: projected
                        ? NotificationChannel.User
                        : NotificationChannel.GameInstance,
                    notification: projected
                        ? {
                              id: step,
                              type: NotificationCategory.Game,
                              action: GameNotificationAction.ReplaceProjectedActions,
                              data: {
                                  game: result.game,
                                  actionReplay: {
                                      startIndex: history.startIndex,
                                      actions: [...history.actions]
                                  },
                                  checksum:
                                      recovery === 'corruptReplay'
                                          ? result.checksum + 1
                                          : result.checksum,
                                  perspective: PLAYER_B_PERSPECTIVE
                              }
                          }
                        : {
                              id: step,
                              type: NotificationCategory.Game,
                              action: GameNotificationAction.UndoAction,
                              data: {
                                  game: result.game,
                                  canonicalReplay: {
                                      startIndex: result.actionReplay.startIndex,
                                      actionIds: result.actionReplay.actions.map(
                                          (action) => action.id
                                      ),
                                      userActionIds: result.actionReplay.actions
                                          .filter((action) => action.source === ActionSource.User)
                                          .map((action) => action.id)
                                  },
                                  redoneActions: result.redoneActions,
                                  checksum:
                                      recovery === 'corruptReplay'
                                          ? result.checksum + 1
                                          : result.checksum,
                                  action: aBid,
                                  undoneActionId: aBid.id
                              }
                          }
                })
            } else {
                const startIndex = host.actions.length
                host.apply(
                    step === 'add-before'
                        ? createBid('bid-b-03', PLAYER_B_ID, 3)
                        : createBid('bid-a-04', PLAYER_A_ID, 4)
                )
                const history = projectHostHistorySuffix(host, startIndex, PLAYER_B_PERSPECTIVE)
                await appContext.notificationService.emit({
                    eventType: NotificationEventType.Data,
                    channel: projected
                        ? NotificationChannel.User
                        : NotificationChannel.GameInstance,
                    notification: projected
                        ? {
                              id: step,
                              type: NotificationCategory.Game,
                              action: GameNotificationAction.AddProjectedActions,
                              data: {
                                  game: host.gameWithoutState(),
                                  actions: [...history.actions],
                                  perspective: PLAYER_B_PERSPECTIVE
                              }
                          }
                        : {
                              id: step,
                              type: NotificationCategory.Game,
                              action: GameNotificationAction.AddActions,
                              data: {
                                  game: host.gameWithoutState(),
                                  actions: host.actionsSnapshot().slice(startIndex)
                              }
                          }
                })
                if (step === 'add-before' && busyReason === 'presentation') {
                    await tick()
                    busyDuringDelivery = session.busy
                    initialChecksum = session.history.visibleContext.state.actionChecksum
                }
            }
        }
        if (recovery === 'discontinuity') {
            await appContext.notificationService.emit({
                eventType: NotificationEventType.Discontinuity,
                channel: projected ? NotificationChannel.User : NotificationChannel.GameInstance
            })
        }
        const unchangedWhileBusy =
            session.history.visibleContext.state.actionChecksum === initialChecksum
        session.processingActions = false
        releasePresentation()
        await tick()
        await waitUntilHistoryIsEnabled(session)
        const expected = projectHostHistory(host, projected ? PLAYER_B_PERSPECTIVE : undefined)
        return {
            busyDuringDelivery,
            unchangedWhileBusy,
            syncRequests,
            metadataMatches: valuesMatch(
                session.history.visibleContext.game.activePlayerIds,
                host.state.activePlayerIds
            ),
            stateMatches: valuesMatch(session.history.visibleContext.state, expected.currentState),
            actualActionIds: session.history.visibleContext.actions.map((action) => action.id),
            expectedActionIds: expected.actions.map((action) => action.id)
        }
    } finally {
        session.stopListeningToGame()
        session.dispose()
        bridgedContext.dispose()
    }
}

export async function runIncompatibleHistory() {
    const host = createAuctionHost()
    const oldAction = host.apply(createBid('old-bid-a', PLAYER_A_ID, 1))
    oldAction.undoPatch?.push({ op: 'remove', path: '/board' })
    const { appContext, bridgedContext, session } = createHistoryClient(host)
    appContext.authorizationService.debugViewEnabled = false
    appContext.authorizationService.adminCapabilitiesEnabled = false
    const api = appContext.api
    const original = {
        getGame: api.getGame,
        checkSync: api.checkSync,
        applyAction: api.applyAction,
        undoAction: api.undoAction
    }
    let reloads = 0
    let syncRequests = 0
    api.getGame = async () => {
        reloads += 1
        const history = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        return {
            game: { ...host.gameWithoutState(), state: history.currentState },
            actions: [...history.actions]
        }
    }
    api.checkSync = async () => {
        syncRequests += 1
        const history = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        return {
            status: GameSyncStatus.OutOfSync,
            actions: [...history.actions],
            checksum: host.state.actionChecksum
        }
    }
    api.applyAction = async (_game, action) => {
        const startIndex = host.actions.length
        host.apply(action)
        const history = projectHostHistorySuffix(host, startIndex, PLAYER_B_PERSPECTIVE)
        return { game: host.gameWithoutState(), actions: [...history.actions] }
    }
    api.undoAction = async (_game, actionId) => {
        const result = host.undo(actionId)
        const history = projectHostHistorySuffix(
            host,
            result.actionReplay.startIndex,
            PLAYER_B_PERSPECTIVE
        )
        const replay = { startIndex: history.startIndex, actions: [...history.actions] }
        return {
            ...result,
            actionReplay: replay,
            canonicalReplay: { ...replay, userActions: [] },
            perspective: PLAYER_B_PERSPECTIVE
        }
    }
    try {
        await waitUntilHistoryIsEnabled(session)
        const initialHasHistory = session.history.hasPreviousAction
        await session.history.goToBeginning()
        await tick()
        session.history.goToEnd()
        await new Promise<void>((resolve) => setTimeout(resolve))
        await session.applyAction(createBid('new-bid-b', PLAYER_B_ID, 2))
        await waitUntilHistoryIsEnabled(session)
        await session.waitForVisibleTransitionSettled()
        const forwardMatches = valuesMatch(
            session.history.visibleContext.state,
            projectHostHistory(host, PLAYER_B_PERSPECTIVE).currentState
        )
        const forwardDifference = forwardMatches
            ? undefined
            : describeFirstDifference(
                  session.history.visibleContext.state,
                  projectHostHistory(host, PLAYER_B_PERSPECTIVE).currentState
              )
        const undoCandidate = session.undoableAction?.id
        await session.history.goToBeginning()
        await waitUntilHistoryIsEnabled(session)
        const boundary = {
            index: session.history.actionIndex,
            count: session.history.visibleContext.state.actionCount,
            hasPrevious: session.history.hasPreviousAction
        }
        await session.history.goToPlayersPreviousTurn(PLAYER_C_ID)
        await waitUntilHistoryIsEnabled(session)
        await session.history.replayRange(0, 1, { holdMs: 0 })
        await new Promise<void>((resolve) => setTimeout(resolve))
        await waitUntilHistoryIsEnabled(session)
        session.history.goToEnd()
        await waitUntilHistoryIsEnabled(session)
        await session.undo()
        await waitUntilHistoryIsEnabled(session)
        const undoMatches = valuesMatch(
            session.history.visibleContext.state,
            projectHostHistory(host, PLAYER_B_PERSPECTIVE).currentState
        )
        const undoCount = host.state.actionCount
        await session.applyAction(createBid('next-bid-b', PLAYER_B_ID, 3))
        await waitUntilHistoryIsEnabled(session)
        return {
            initialHasHistory,
            forwardMatches,
            forwardDifference,
            undoCandidate,
            boundary,
            undoMatches,
            undoCount,
            reloads,
            syncRequests,
            finalMatches: valuesMatch(
                session.history.visibleContext.state,
                projectHostHistory(host, PLAYER_B_PERSPECTIVE).currentState
            ),
            finalCount: host.state.actionCount,
            finalActionId: host.actions.at(-1)?.id,
            containsHiddenBag: session.history.visibleContext.state.tileBag.items.length > 0
        }
    } finally {
        Object.assign(api, original)
        session.dispose()
        bridgedContext.dispose()
    }
}
