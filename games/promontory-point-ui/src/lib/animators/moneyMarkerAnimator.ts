import { gsap } from 'gsap'
import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { GameAction } from '@tabletop/common'
import type { HydratedPromontoryPointGameState } from '@tabletop/promontory-point'
import { BORDER_TRACK_LENGTH, BORDER_TRACK_SPACES, boxCentre } from '$lib/utils/boardGeometry.js'
import { moneyMarkers, type MoneyMarker } from '$lib/utils/boardLayout.js'
import {
    MarkerMotion,
    samePose,
    type BoardAnimationHost,
    type BoardStateChange,
    type MarkerPose,
    type Timeline
} from './markerMotion.js'
import type { MoneyChip, MoneyChips } from './moneyChips.svelte.js'
import { townEffectStartsAt } from './placementSchedule.js'

export type MoneyChipHost = Pick<MoneyChips, 'show' | 'clear' | 'element'>

// A long move takes no longer than this; a short one steps at the full pace.
export const MONEY_SECONDS_PER_SPACE = 0.07
const MOST_STEPPING_SECONDS = 1.1
// Markers sharing a space make room as the mover arrives, or spread out once it leaves.
const SETTLE_SECONDS = 0.2
const CHIP = { popSeconds: 0.14, riseSeconds: 0.75, fadeSeconds: 0.25, risePixels: 20 }
// Reduced motion: the chip shows without moving, as long as it would have risen.
const STILL_CHIP_SECONDS = CHIP.popSeconds + CHIP.riseSeconds

// One seat's marker alone in a space, or a quarter of a space shared.
export function moneyMarkerSize(marker: Pick<MoneyMarker, 'box' | 'shared'>): number {
    return Math.min(marker.box.width, marker.box.height) * (marker.shared ? 0.88 : 0.6)
}

export function markerPose(marker: MoneyMarker): MarkerPose {
    return { ...boxCentre(marker.box), size: moneyMarkerSize(marker) }
}

// A marker passing through a space stands where it would alone there.
export function passingPose(space: number): MarkerPose {
    const { box } = BORDER_TRACK_SPACES[space]
    return { ...boxCentre(box), size: moneyMarkerSize({ box, shared: false }) }
}

// R-1.3-H1: the spaces passed between two amounts, forward through 99 to 0 when money rises past
// a hundred, back through 0 to 99 when it falls below.
function spacesPassed(before: number, after: number): number[] {
    const direction = Math.sign(after - before)
    return Array.from({ length: Math.abs(after - before) - 1 }, (_, step) => {
        const money = before + (step + 1) * direction
        return ((money % BORDER_TRACK_LENGTH) + BORDER_TRACK_LENGTH) % BORDER_TRACK_LENGTH
    })
}

function layout(state: HydratedPromontoryPointGameState): Map<string, MoneyMarker> {
    const markers = moneyMarkers(state.players.map(({ playerId, money }) => ({ playerId, money })))
    return new Map(markers.map((marker) => [marker.playerId, marker]))
}

// R-1.3-H1: each seat's money marker steps along the border track, a chip rising from its seat
// card's money with the change. Undo and history move every marker straight to its place, at
// once under reduced motion.
export class MoneyMarkerAnimator {
    readonly motion = new MarkerMotion<string>()
    private readonly listener = (change: BoardStateChange) => this.onGameStateChange(change)

    constructor(
        private host: BoardAnimationHost,
        private chips: MoneyChipHost,
        private reducedMotion: () => boolean = () => prefersReducedMotion.current
    ) {}

    register() {
        this.host.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.host.removeGameStateChangeListener(this.listener)
        this.motion.clear()
        this.chips.clear()
    }

    private async onGameStateChange({ from, to, action, animationContext }: BoardStateChange) {
        if (!from) return
        const timeline = animationContext.actionTimeline
        const targets = layout(to)
        const moneyBefore = new Map(from.players.map((player) => [player.playerId, player.money]))
        const changes = to.players.flatMap(({ playerId, money }) => {
            const before = moneyBefore.get(playerId)
            return before === undefined || before === money
                ? []
                : [{ playerId, before, after: money }]
        })
        const settlers = [...targets.values()].filter((marker) => {
            const pose = this.motion.poseOf(marker.playerId)
            return (
                pose !== undefined &&
                !changes.some((change) => change.playerId === marker.playerId) &&
                !samePose(pose, markerPose(marker))
            )
        })
        if (changes.length === 0 && settlers.length === 0) return

        const reduced = this.reducedMotion()
        if (!action) {
            for (const marker of targets.values()) {
                const pose = this.motion.poseOf(marker.playerId)
                if (!pose || samePose(pose, markerPose(marker))) continue
                if (reduced) this.motion.jump(marker.playerId, markerPose(marker))
                else this.motion.glide(timeline, marker.playerId, markerPose(marker), 0)
            }
            return
        }

        const start = townEffectStartsAt(action, reduced)
        let landed = start
        for (const { playerId, before, after } of changes) {
            const target = targets.get(playerId)
            if (!target) continue
            if (reduced) {
                this.motion.jump(playerId, markerPose(target))
                continue
            }
            const current = this.motion.poseOf(playerId)
            if (!current) continue
            const poses = [
                current,
                ...spacesPassed(before, after).map(passingPose),
                markerPose(target)
            ]
            const hops = poses.length - 1
            const secondsPerHop = Math.min(MONEY_SECONDS_PER_SPACE, MOST_STEPPING_SECONDS / hops)
            landed = Math.max(
                landed,
                this.motion.travel(timeline, playerId, poses, start, secondsPerHop)
            )
        }
        for (const marker of settlers) {
            if (reduced) this.motion.jump(marker.playerId, markerPose(marker))
            else
                this.motion.glide(
                    timeline,
                    marker.playerId,
                    markerPose(marker),
                    Math.max(start, landed - SETTLE_SECONDS),
                    SETTLE_SECONDS
                )
        }
        await this.riseChips(action, changes, timeline, start, reduced)
        animationContext.afterAnimations(() => this.chips.clear())
    }

    // Presence for this replayed action only: the next one overwrites it, and its end clears it.
    private async riseChips(
        action: GameAction,
        changes: { playerId: string; before: number; after: number }[],
        timeline: Timeline,
        start: number,
        reduced: boolean
    ) {
        const chips: MoneyChip[] = changes.map(({ playerId, before, after }) => ({
            id: `${action.id}:${playerId}`,
            playerId,
            change: after - before
        }))
        this.chips.show(chips)
        await tick()
        for (const chip of chips) {
            const element = this.chips.element(chip.id)
            if (!element) continue
            gsap.set(element, { opacity: 0, y: 0, scale: 1 })
            if (reduced) {
                timeline.set(element, { opacity: 1 }, start)
                timeline.set(element, { opacity: 0 }, start + STILL_CHIP_SECONDS)
                continue
            }
            timeline.fromTo(
                element,
                { opacity: 0, scale: 0.6 },
                { opacity: 1, scale: 1, duration: CHIP.popSeconds, ease: 'back.out(2)' },
                start
            )
            timeline.to(
                element,
                { y: -CHIP.risePixels, duration: CHIP.riseSeconds, ease: 'power1.out' },
                start + CHIP.popSeconds
            )
            timeline.to(
                element,
                { opacity: 0, duration: CHIP.fadeSeconds, ease: 'power1.in' },
                start + CHIP.popSeconds + CHIP.riseSeconds - CHIP.fadeSeconds
            )
        }
    }
}
