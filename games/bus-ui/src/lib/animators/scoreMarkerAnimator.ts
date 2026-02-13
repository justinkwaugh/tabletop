import type { Point } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { gsap } from 'gsap'
import type { BusGameState, HydratedBusGameState } from '@tabletop/bus'
import { BUS_SCORE_TRACK_POINTS } from '$lib/definitions/busBoardGraph.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

export const SCORE_MARKER_STACK_OFFSET_Y = 5

export type ScoreMarkerPlacement = {
    key: string
    playerId: string
    point: Point
    score: number
}

export function buildScoreMarkerPlacements(state: HydratedBusGameState): ScoreMarkerPlacement[] {
    const playerById = new Map(state.players.map((player) => [player.playerId, player]))
    const markers: ScoreMarkerPlacement[] = []
    const stackOffsetsByScore = new Map<number, number>()

    for (const playerId of state.scoreOrder) {
        const player = playerById.get(playerId)
        if (!player) {
            continue
        }

        const score = Math.max(0, Math.round(player.score))
        const scoreIndex = Math.min(score, BUS_SCORE_TRACK_POINTS.length - 1)
        const scorePoint = BUS_SCORE_TRACK_POINTS[scoreIndex]
        if (!scorePoint) {
            continue
        }

        const stackIndex = stackOffsetsByScore.get(score) ?? 0
        stackOffsetsByScore.set(score, stackIndex + 1)

        markers.push({
            key: `score:${playerId}`,
            playerId,
            point: {
                x: scorePoint.x,
                y: scorePoint.y - stackIndex * SCORE_MARKER_STACK_OFFSET_Y
            },
            score
        })
    }

    return markers
}

export class ScoreMarkerAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    private scoreMarkers = new Map<string, HTMLElement | SVGElement>()

    setScoreMarker(key: string, element?: HTMLElement | SVGElement): void {
        if (!element) {
            this.scoreMarkers.delete(key)
            return
        }
        this.scoreMarkers.set(key, element)
    }

    override async onGameStateChange({
        to,
        from,
        animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) {
            return
        }

        const fromByKey = new Map(
            buildScoreMarkerPlacements(from).map((marker) => [marker.key, marker] as const)
        )
        const toByKey = new Map(
            buildScoreMarkerPlacements(to).map((marker) => [marker.key, marker] as const)
        )

        for (const [key, fromMarker] of fromByKey) {
            const toMarker = toByKey.get(key)
            if (!toMarker) {
                continue
            }
            if (fromMarker.point.x === toMarker.point.x && fromMarker.point.y === toMarker.point.y) {
                continue
            }

            const element = this.scoreMarkers.get(key)
            if (!element) {
                continue
            }

            // When a marker is moving upward because it scored, keep it visually on top.
            if (toMarker.score > fromMarker.score && toMarker.point.y < fromMarker.point.y) {
                this.bringToFront(element)
            }

            element.setAttribute('transform', `translate(${fromMarker.point.x} ${fromMarker.point.y})`)

            animationContext.actionTimeline.to(
                element,
                {
                    attr: {
                        transform: `translate(${toMarker.point.x} ${toMarker.point.y})`
                    },
                    duration: 0.42,
                    ease: 'power2.inOut'
                },
                0
            )
        }
    }

    private bringToFront(element: HTMLElement | SVGElement): void {
        const parent = element.parentNode
        if (!parent) {
            return
        }
        parent.appendChild(element)
    }
}

export function animateScoreMarker(
    node: HTMLElement | SVGElement,
    params: { animator: ScoreMarkerAnimator; markerKey: string }
): { destroy: () => void } {
    params.animator.setScoreMarker(params.markerKey, node)
    return {
        destroy() {
            params.animator.setScoreMarker(params.markerKey, undefined)
        }
    }
}
