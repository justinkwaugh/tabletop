import { get } from 'svelte/store'
import type {
    BugReportClient,
    BugReportRequest,
    BugReportScreenshot,
    GameState,
    HydratedGameState
} from '@tabletop/common'
import type { GameSession, ManifestService } from '@tabletop/frontend-components'
import { isInstalledApp } from '$lib/stores/pwaInstallPrompt.svelte.js'

const USER_AGENT_MAX_LENGTH = 512

export function bugReportRequest({
    session,
    description,
    screenshots,
    manifestService
}: {
    session: GameSession<GameState, HydratedGameState>
    description: string
    screenshots: readonly BugReportScreenshot[]
    manifestService: ManifestService
}): BugReportRequest {
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
        screenshots: screenshots.length > 0 ? [...screenshots] : undefined
    }
}

function bugReportClient(): BugReportClient {
    return {
        userAgent: navigator.userAgent.slice(0, USER_AGENT_MAX_LENGTH),
        viewport: `${window.innerWidth}x${window.innerHeight} @${Number(window.devicePixelRatio.toFixed(2))}x`,
        installedApp: isInstalledApp()
    }
}
