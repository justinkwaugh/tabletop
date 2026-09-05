import {
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

function createProjectedClient(host: CanonicalHost) {
    const projectedHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
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
        runtime: FreshFishUiRuntime,
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
    const { bridgedContext, session } = createProjectedClient(host)

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

export async function runBusyProjectedUndo(
    busyReason: 'processing' | 'presentation',
    recovery: 'none' | 'corruptReplay' | 'discontinuity' = 'none'
) {
    const host = createAuctionHost()
    const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
    host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
    const { appContext, bridgedContext, session } = createProjectedClient(host)
    let syncRequests = 0
    appContext.api.checkSync = async () => {
        syncRequests += 1
        const history = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        return {
            status: GameSyncStatus.OutOfSync,
            actions: [...history.actions],
            checksum: host.state.actionChecksum
        }
    }
    appContext.api.getGame = async () => {
        const history = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
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
        for (const step of ['add-before', 'undo', 'add-after']) {
            if (step === 'undo') {
                const result = host.undo(aBid.id)
                const history = projectHostHistorySuffix(
                    host,
                    result.actionReplay.startIndex,
                    PLAYER_B_PERSPECTIVE
                )
                await appContext.notificationService.emit({
                    eventType: NotificationEventType.Data,
                    channel: NotificationChannel.User,
                    notification: {
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
                    channel: NotificationChannel.User,
                    notification: {
                        id: step,
                        type: NotificationCategory.Game,
                        action: GameNotificationAction.AddProjectedActions,
                        data: {
                            game: host.gameWithoutState(),
                            actions: [...history.actions],
                            perspective: PLAYER_B_PERSPECTIVE
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
                channel: NotificationChannel.User
            })
        }
        const unchangedWhileBusy =
            session.history.visibleContext.state.actionChecksum === initialChecksum
        session.processingActions = false
        releasePresentation()
        await tick()
        await waitUntilHistoryIsEnabled(session)
        const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
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
