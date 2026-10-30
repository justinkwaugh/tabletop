import { prefersReducedMotion } from 'svelte/motion'
import type { GameAction } from '@tabletop/common'
import {
    MAX_PRICE_INDEX,
    MIN_PRICE_INDEX,
    RAILROAD_IDS,
    TownEventKind,
    isPlaceTrack,
    type RailroadId
} from '@tabletop/promontory-point'
import { boxCentre } from '$lib/utils/boardGeometry.js'
import { priceMarkerSlot } from '$lib/utils/boardLayout.js'
import {
    MarkerMotion,
    type BoardAnimationHost,
    type BoardStateChange,
    type MarkerPose,
    type Timeline
} from './markerMotion.js'
import { townEffectStartsAt } from './placementSchedule.js'

export const PRICE_SECONDS_PER_SPACE = 0.13
const BUMP = { distance: 22, outSeconds: 0.07, backSeconds: 0.11 }

export function priceMarkerPose(railroadId: RailroadId, priceIndex: number): MarkerPose {
    return { ...boxCentre(priceMarkerSlot(railroadId, priceIndex)), size: 1 }
}

// R-1.2: whether the action's price move stopped at an end of the track, and at which end.
function cappedLimit(action: GameAction | undefined, railroadId: RailroadId): number | undefined {
    if (!isPlaceTrack(action)) return undefined
    const outcome = action.metadata?.outcome
    if (outcome?.kind !== TownEventKind.PriceChange || outcome.railroadId !== railroadId) {
        return undefined
    }
    if (!outcome.capped) return undefined
    return outcome.priceChange > 0 ? MAX_PRICE_INDEX : MIN_PRICE_INDEX
}

// R-1.2, R-4.2: a price town's marker steps space by space along the price track; stopped at an
// end, it bumps once against it. Undo and history move it straight there.
export class PriceMarkerAnimator {
    readonly motion = new MarkerMotion<RailroadId>()
    private readonly listener = (change: BoardStateChange) => this.onGameStateChange(change)

    constructor(
        private host: BoardAnimationHost,
        private reducedMotion: () => boolean = () => prefersReducedMotion.current
    ) {}

    register() {
        this.host.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.host.removeGameStateChangeListener(this.listener)
        this.motion.clear()
    }

    private async onGameStateChange({ from, to, action, animationContext }: BoardStateChange) {
        if (!from) return
        const timeline = animationContext.actionTimeline
        const reduced = this.reducedMotion()
        for (const railroadId of RAILROAD_IDS) {
            const before = from.priceIndex[railroadId]
            const after = to.priceIndex[railroadId]
            const target = priceMarkerPose(railroadId, after)
            if (!action) {
                if (before !== after) this.motion.glide(timeline, railroadId, target, 0)
                continue
            }
            const limit = cappedLimit(action, railroadId)
            if (before === after && limit === undefined) continue
            const start = townEffectStartsAt(action, reduced)
            if (reduced) {
                this.motion.jump(railroadId, target)
                continue
            }
            const poses = [
                ...indicesBetween(before, after).map((index) => priceMarkerPose(railroadId, index)),
                target
            ]
            const current = this.motion.poseOf(railroadId)
            if (current) poses[0] = current
            const landed = this.motion.travel(
                timeline,
                railroadId,
                poses,
                start,
                PRICE_SECONDS_PER_SPACE
            )
            if (limit !== undefined) this.bump(timeline, railroadId, limit, landed)
        }
    }

    // R-1.2: the marker nudges past the end it stopped at and springs back.
    private bump(timeline: Timeline, railroadId: RailroadId, limit: number, at: number) {
        const end = priceMarkerPose(railroadId, limit)
        const inside = priceMarkerPose(
            railroadId,
            limit === MAX_PRICE_INDEX ? limit - 1 : limit + 1
        )
        const dx = end.x - inside.x
        const dy = end.y - inside.y
        const length = Math.hypot(dx, dy) || 1
        const past = {
            x: end.x + (dx / length) * BUMP.distance,
            y: end.y + (dy / length) * BUMP.distance,
            size: end.size
        }
        const out = this.motion.travel(
            timeline,
            railroadId,
            [end, past],
            at,
            BUMP.outSeconds,
            'power2.out'
        )
        this.motion.travel(timeline, railroadId, [past, end], out, BUMP.backSeconds, 'power2.in')
    }
}

// From the first index to the last, both included, one space at a time.
function indicesBetween(before: number, after: number): number[] {
    const direction = Math.sign(after - before)
    return Array.from({ length: Math.abs(after - before) }, (_, step) => before + step * direction)
}
