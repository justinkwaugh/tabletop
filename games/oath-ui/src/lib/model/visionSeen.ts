import { isSearch, isUseActionPower } from '@tabletop/oath'
import type { GameAction } from '@tabletop/common'

export interface VisionDraw {
    actionId: string
    drawerId: string
}

/** R-5.1.2, R-9.4 — every public Vision draw, oldest first. */
function visionDraws(actions: readonly GameAction[]): VisionDraw[] {
    return actions.flatMap((action): VisionDraw[] => {
        const drawn =
            (isSearch(action) && action.metadata?.stoppedOnVision === true) ||
            (isUseActionPower(action) && action.metadata?.visionDrawn === true)
        return drawn && action.playerId ? [{ actionId: action.id, drawerId: action.playerId }] : []
    })
}

export function unseenVisionDraws(
    actions: readonly GameAction[],
    clearedDrawIds: readonly string[]
): VisionDraw[] {
    return visionDraws(actions).filter((draw) => !clearedDrawIds.includes(draw.actionId))
}

export function drawIdsClearedBy(
    actions: readonly GameAction[],
    clearedDrawIds: readonly string[]
): string[] {
    return [...new Set([...clearedDrawIds, ...visionDraws(actions).map((draw) => draw.actionId)])]
}

export function readClearedDrawIds(stored: string | undefined): string[] {
    if (stored === undefined) return []
    return storedArray(stored).filter((id): id is string => typeof id === 'string')
}

export function saveClearedDrawIds(
    storage: Pick<Storage, 'setItem'> | undefined,
    key: string,
    clearedDrawIds: readonly string[]
): void {
    // A full or blocked storage throws on writing; the clear then lasts for this visit only.
    try {
        storage?.setItem(key, JSON.stringify(clearedDrawIds))
    } catch {
        return
    }
}

// Browser storage can hold anything under the key; a value that is not a list clears nothing.
function storedArray(stored: string): unknown[] {
    try {
        const parsed: unknown = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export function visionsClearedKey(gameId: string, playerId: string): string {
    return `oath:${gameId}:${playerId}:visionsCleared`
}
