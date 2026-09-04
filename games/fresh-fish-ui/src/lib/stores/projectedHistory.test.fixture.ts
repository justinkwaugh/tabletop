import { assertExists, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    BridgedContext,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import { FreshFishRuntime } from '@tabletop/fresh-fish'
import { tick } from 'svelte'
import { FreshFishUiRuntime } from '../definition/gameUiRuntime.js'
import { UiDefinition } from '../index.js'
import { FreshFishGameSession } from './FreshFishGameSession.svelte.js'
import {
    GAME_ID,
    PLAYER_A_ID,
    PLAYER_B_ID,
    PLAYER_B_PERSPECTIVE,
    PLAYER_C_ID,
    PLAYER_D_ID,
    createAuctionHost,
    createBid,
    projectHostHistory
} from './simultaneousAuction.testSupport.js'

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

    const projectedHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
    const projectedBeforeAuction = FreshFishRuntime.visibility.state.project(
        canonicalBeforeAuction,
        PLAYER_B_PERSPECTIVE
    )
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
