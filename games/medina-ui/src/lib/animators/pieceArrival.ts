import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    isPlaceBuilding,
    isPlaceMerchant,
    isPlaceRooftop,
    isPlaceStable,
    isPlaceWall,
    type HydratedMedinaGameState
} from '@tabletop/medina'
import { rooftopKey, spaceKey, wallKey } from '$lib/utils/boardPieces.js'

export const GHOST_OPACITY = 0.7

const ARRIVAL_DURATION = 0.28

export function arrivalKeysOf(
    action: GameAction | undefined,
    state: HydratedMedinaGameState
): string[] {
    if (isPlaceBuilding(action)) {
        return [spaceKey('building', action.coords)]
    }
    if (isPlaceStable(action)) {
        return [spaceKey('stable', action.coords)]
    }
    if (isPlaceMerchant(action)) {
        return [spaceKey('merchant', action.coords)]
    }
    if (isPlaceWall(action)) {
        return [wallKey(action.side, action.position)]
    }
    if (isPlaceRooftop(action)) {
        const palace = state.palaceAt(action.coords)
        return palace ? [rooftopKey(palace.id)] : []
    }
    return []
}

// A piece the player was previewing firms up from the ghost; any other piece fades in from nothing.
export function playArrival(
    board: SVGSVGElement | undefined,
    keys: string[],
    startOpacity: number,
    { actionTimeline }: AnimationContext
) {
    if (!board) {
        return
    }
    for (const key of keys) {
        const piece = board.querySelector(`[data-arrival-key="${key}"]`)
        if (piece) {
            actionTimeline.fromTo(
                piece,
                { opacity: startOpacity },
                { opacity: 1, duration: ARRIVAL_DURATION, clearProps: 'opacity' },
                0
            )
        }
        const shadow = board.querySelector(`[data-shadow-key="${key}"]`)
        if (shadow) {
            actionTimeline.fromTo(
                shadow,
                { opacity: 0 },
                { opacity: 1, duration: ARRIVAL_DURATION, clearProps: 'opacity' },
                0
            )
        }
    }
}
