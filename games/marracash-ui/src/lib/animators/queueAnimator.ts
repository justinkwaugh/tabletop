import { prefersReducedMotion } from 'svelte/motion'
import { gsap } from 'gsap'
import type { Point } from '@tabletop/common'
import type { AnimationContext, GameStateChangeListener } from '@tabletop/frontend-components'
import { isBringVisitors, type HydratedMarracashGameState } from '@tabletop/marracash'
import type { MarracashGameSession } from '$lib/model/session.svelte.js'
import {
    pointAtQueueSlot,
    queueRunnerLabels,
    runnerLength,
    runnerPace,
    runnerPoseAt,
    runnerReach
} from '$lib/utils/boardGeometry.js'
import { backTrim, frontShift } from '$lib/utils/queueShift.js'
import { DirectSeconds } from '$lib/animators/visitorMoveAnimator.js'

const LeaveSeconds = 0.18
const SlideSecondsPerPlace = 0.12
const MinSlideSeconds = 0.3
const MaxSlideSeconds = 0.7
// The roll travels at one speed, so a long stretch, such as round a corner, takes longer.
const RollPixelsPerSecond = 420
const MinRollUpSeconds = 0.3
const UnrollSeconds = 0.3
// The roll stops this far behind the last visitor's feet, then unrolls to make room for "Back".
const RollClearance = 4
// The roll starts as a thin curl and thickens as carpet winds into it.
const RollThickness = { least: 4, most: 18, pixelsPerStep: 12 }
const RollBodyWidth = 10
// The mask's dash is far longer than any runner, so a dash of the runner's length shows all of it.
const RevealGap = 100000
const CutOverlap = 30

type GameStateChange = Parameters<GameStateChangeListener<HydratedMarracashGameState>>[0]

export type RunnerPart =
    'reveal' | 'cut' | 'back' | 'backLabel' | 'roll' | 'rollBody' | 'rollFringe'

export type QueueAnimationHost = Pick<
    MarracashGameSession,
    'addGameStateChangeListener' | 'removeGameStateChangeListener'
>

// Visitors keep their element for the whole game, named by their place in the original queue, and
// their position belongs to GSAP: placed when they mount or change place, moved here when visitors
// leave or return at the front. The runner's back end rolls up behind the line as it shortens,
// then unrolls a little to make room for its label.
export class QueueAnimator {
    private elements = new Map<number, SVGElement>()
    private runnerParts = new Map<RunnerPart, SVGElement>()
    private readonly listener = (change: GameStateChange) => this.onGameStateChange(change)

    constructor(private gameSession: QueueAnimationHost) {}

    register() {
        this.gameSession.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.gameSession.removeGameStateChangeListener(this.listener)
        this.elements.clear()
        this.runnerParts.clear()
    }

    setElement(visitorId: number, element: SVGElement | undefined) {
        if (element) this.elements.set(visitorId, element)
        else this.elements.delete(visitorId)
    }

    setRunnerPart(part: RunnerPart, element: SVGElement) {
        this.runnerParts.set(part, element)
    }

    // A keyed part's replacement can mount before the old one is destroyed, so only the element
    // still registered is forgotten.
    clearRunnerPart(part: RunnerPart, element: SVGElement) {
        if (this.runnerParts.get(part) === element) this.runnerParts.delete(part)
    }

    private async onGameStateChange({ from, to, action, animationContext }: GameStateChange) {
        if (!from || this.elements.size === 0) return
        const shift = frontShift(from.queue, to.queue)
        const trimmed = backTrim(from.queue, to.queue)
        if (shift === 0 && trimmed === 0) return
        // The visitors on screen are the from-state's, so the front one has the lowest id.
        const firstId = Math.min(...this.elements.keys())
        const cinematic = isBringVisitors(action) && !prefersReducedMotion.current
        if (!cinematic) {
            if (shift !== 0) this.moveDirectly(firstId, from.queue.length, shift, animationContext)
            return
        }
        const timeline = animationContext.actionTimeline
        // The line settles first, whichever end visitors left, then the runner rolls up behind it.
        let settled = LeaveSeconds
        if (shift > 0) {
            settled += this.slideAlongRunner(firstId, from.queue.length, shift, timeline)
        } else {
            for (let place = to.queue.length; place < from.queue.length; place++) {
                const leaving = this.elements.get(firstId + place)
                if (leaving) timeline.to(leaving, { opacity: 0, duration: LeaveSeconds }, 0)
            }
        }
        this.rollUp(from.queue.length, to.queue.length, timeline, settled)
    }

    // The visitors taken from the front step out of line, then everyone behind them walks forward
    // along the runner, round its corners, to close the gap. Returns the walk's length in seconds.
    private slideAlongRunner(
        firstId: number,
        count: number,
        shift: number,
        timeline: gsap.core.Timeline
    ): number {
        for (let place = 0; place < shift; place++) {
            const leaving = this.elements.get(firstId + place)
            if (leaving) timeline.to(leaving, { opacity: 0, duration: LeaveSeconds }, 0)
        }
        const duration = Math.min(
            MaxSlideSeconds,
            Math.max(MinSlideSeconds, shift * SlideSecondsPerPlace)
        )
        const stayers = this.stayers(firstId, count, shift)
        const progress = { moved: 0 }
        timeline.to(
            progress,
            {
                moved: shift,
                duration,
                ease: 'power1.inOut',
                onUpdate: () => {
                    for (const { element, place } of stayers) {
                        this.place(element, pointAtQueueSlot(place - progress.moved))
                    }
                }
            },
            LeaveSeconds
        )
        return duration
    }

    // The back of the runner rolls up behind the line to its new last visitor, then unrolls just
    // far enough for "Back": the roll shrinks as it goes and leaves its fringe at the new end. The
    // old end's fringe and label fade out first; the new label fades in once the state lands.
    private rollUp(
        fromCount: number,
        toCount: number,
        timeline: gsap.core.Timeline,
        start: number
    ) {
        const reveal = this.runnerParts.get('reveal')
        const cut = this.runnerParts.get('cut')
        const roll = this.runnerParts.get('roll')
        const body = this.runnerParts.get('rollBody')
        const fringe = this.runnerParts.get('rollFringe')
        if (!reveal || !cut || !roll || !body || !fringe || toCount === 0) return
        const before = runnerReach(fromCount, queueRunnerLabels(fromCount)[1])
        const after = runnerReach(toCount, queueRunnerLabels(toCount)[1])
        const stop = after.tail + RollClearance
        const end = { at: before.end }
        const pace = runnerPace(before.end, stop)
        const rollUpSeconds = Math.max(MinRollUpSeconds, pace.length / RollPixelsPerSecond)
        const rolled = { progress: 0 }
        let thickest = RollThickness.least
        const show = (along: number, thickness: number, fringeShown: number) => {
            // The reveal runs a little past the roll and the cut trims it along the roll's line.
            reveal.setAttribute(
                'stroke-dasharray',
                `${runnerLength(before.start, along) + CutOverlap} ${RevealGap}`
            )
            const { at, angle } = runnerPoseAt(along)
            const pose = `translate(${at.x} ${at.y}) rotate(${angle})`
            // A plain transform: GSAP would rotate SVG about its bounding box, not this origin.
            roll.setAttribute('transform', pose)
            cut.setAttribute('transform', pose)
            body.setAttribute('transform', `scale(${thickness / RollBodyWidth} 1)`)
            gsap.set(fringe, { opacity: fringeShown })
        }
        const rollingUp = () => {
            end.at = pace.alongAt(rolled.progress)
            thickest = Math.min(
                RollThickness.most,
                RollThickness.least + (before.end - end.at) / RollThickness.pixelsPerStep
            )
            show(end.at, thickest, 0)
        }
        const unrolling = () => {
            const left = (after.end - end.at) / Math.max(1, after.end - stop)
            show(end.at, thickest * left, 1 - left)
        }

        for (const part of [this.runnerParts.get('back'), this.runnerParts.get('backLabel')]) {
            if (part) timeline.to(part, { opacity: 0, duration: LeaveSeconds }, start)
        }
        timeline.set(roll, { opacity: 1 }, start)
        timeline.set(cut, { attr: { display: 'inline' } }, start)
        timeline.to(
            rolled,
            {
                progress: 1,
                duration: rollUpSeconds,
                ease: 'power1.inOut',
                onStart: rollingUp,
                onUpdate: rollingUp
            },
            start
        )
        timeline.to(
            end,
            { at: after.end, duration: UnrollSeconds, ease: 'power1.out', onUpdate: unrolling },
            start + rollUpSeconds
        )
    }

    // Undo and history move each visitor still in line straight to its new place.
    private moveDirectly(
        firstId: number,
        count: number,
        shift: number,
        animationContext: AnimationContext
    ) {
        for (const { element, place } of this.stayers(firstId, count, Math.max(shift, 0))) {
            const { x, y } = pointAtQueueSlot(place - shift)
            animationContext.actionTimeline.to(element, { x, y, duration: DirectSeconds }, 0)
        }
    }

    private stayers(firstId: number, count: number, shift: number) {
        return Array.from({ length: count - shift }, (_, offset) => {
            const place = shift + offset
            return { element: this.elements.get(firstId + place), place }
        }).filter(
            (stayer): stayer is { element: SVGElement; place: number } =>
                stayer.element !== undefined
        )
    }

    private place(element: SVGElement, point: Point) {
        gsap.set(element, { x: point.x, y: point.y })
    }
}

export function placeQueueVisitor(
    node: SVGElement,
    params: { animator: QueueAnimator; visitorId: number; at: Point }
) {
    let current = params
    gsap.set(node, { x: params.at.x, y: params.at.y, opacity: 1 })
    current.animator.setElement(current.visitorId, node)
    return {
        update(next: typeof params) {
            if (next.visitorId !== current.visitorId) {
                current.animator.setElement(current.visitorId, undefined)
                next.animator.setElement(next.visitorId, node)
            }
            if (next.at.x !== current.at.x || next.at.y !== current.at.y) {
                gsap.set(node, { x: next.at.x, y: next.at.y })
            }
            current = next
        },
        destroy() {
            current.animator.setElement(current.visitorId, undefined)
        }
    }
}

export function registerRunnerPart(
    node: SVGElement,
    params: { animator: QueueAnimator; part: RunnerPart }
) {
    params.animator.setRunnerPart(params.part, node)
    return {
        destroy() {
            params.animator.clearRunnerPart(params.part, node)
        }
    }
}
