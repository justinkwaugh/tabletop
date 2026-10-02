import { isSearch, isUseActionPower } from '@tabletop/oath'
import type { GameAction } from '@tabletop/common'

export interface VisionDraw {
    actionId: string
    drawerId: string
}

/** R-5.1.2, R-9.4 — every public Vision draw after the one last cleared, oldest first. */
export function unseenVisionDraws(
    actions: readonly GameAction[],
    clearedThroughActionId: string | undefined
): VisionDraw[] {
    const cleared = actions.findIndex((action) => action.id === clearedThroughActionId)
    return actions.slice(cleared + 1).flatMap((action): VisionDraw[] => {
        const drawn =
            (isSearch(action) && action.metadata?.stoppedOnVision === true) ||
            (isUseActionPower(action) && action.metadata?.visionDrawn === true)
        return drawn && action.playerId ? [{ actionId: action.id, drawerId: action.playerId }] : []
    })
}

export function visionsClearedKey(gameId: string, playerId: string): string {
    return `oath:${gameId}:${playerId}:visionsCleared`
}
