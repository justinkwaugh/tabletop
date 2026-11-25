import { get } from 'svelte/store'
import {
    BUG_REPORT_LOCAL_GAME_MAX_LENGTH,
    GameStorage,
    scenarioFromGame,
    type BugReportClient,
    type BugReportRequest,
    type BugReportScreenshot,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    APIError,
    type GameSession,
    type GameStore,
    type ManifestService
} from '@tabletop/frontend-components'
import { isInstalledApp } from '$lib/stores/pwaInstallPrompt.svelte.js'
import { m } from '$lib/paraglide/messages'

const USER_AGENT_MAX_LENGTH = 512

export class LocalGameTooLargeError extends Error {
    constructor(gameId: string, length: number) {
        super(`The scenario of local game ${gameId} is ${length} characters long`)
        this.name = 'LocalGameTooLargeError'
    }
}

export async function bugReportRequest({
    session,
    description,
    screenshots,
    localGameStore,
    manifestService
}: {
    session: GameSession<GameState, HydratedGameState>
    description: string
    screenshots: readonly BugReportScreenshot[]
    localGameStore: GameStore
    manifestService: ManifestService
}): Promise<BugReportRequest> {
    const game = session.primaryGame
    return {
        gameId: game.id,
        description: description.trim(),
        view: {
            actionCount: get(session.bridge.gameState)?.actionCount,
            inHistory: get(session.bridge.isViewingHistory),
            exploring: get(session.bridge.isExploring)
        },
        versions: {
            site: manifestService.getFrontendVersion(),
            logic: manifestService.getLogicVersion(game.typeId),
            ui: manifestService.getUiVersion(game.typeId)
        },
        client: bugReportClient(),
        screenshots: screenshots.length > 0 ? [...screenshots] : undefined,
        localGame:
            game.storage === GameStorage.Local
                ? await localGameScenario(localGameStore, game.id)
                : undefined
    }
}

export async function localGameScenario(store: GameStore, gameId: string): Promise<string> {
    const { game, actions } = await store.loadGameData(gameId)
    if (!game?.state) {
        throw new Error(`Local game ${gameId} has no stored state`)
    }
    const json = JSON.stringify(scenarioFromGame({ ...game, state: game.state }, actions))
    if (json.length > BUG_REPORT_LOCAL_GAME_MAX_LENGTH) {
        throw new LocalGameTooLargeError(gameId, json.length)
    }
    return json
}

export function bugReportFailureMessage(error: unknown): string {
    if (error instanceof LocalGameTooLargeError) {
        return m.games_bug_report_too_large()
    }
    if (error instanceof APIError && error.name === 'RateLimited') {
        return m.games_bug_report_rate_limited()
    }
    if (error instanceof APIError) {
        return m.games_bug_report_failed()
    }
    return m.games_bug_report_failed_try_later()
}

function bugReportClient(): BugReportClient {
    return {
        userAgent: navigator.userAgent.slice(0, USER_AGENT_MAX_LENGTH),
        viewport: `${window.innerWidth}x${window.innerHeight} @${Number(window.devicePixelRatio.toFixed(2))}x`,
        installedApp: isInstalledApp()
    }
}
