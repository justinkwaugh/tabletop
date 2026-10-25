import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { sameCoordinates, type AxialCoordinates, type Point } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    isMoveRing,
    isPlaceRing,
    isRemoveRing,
    isRemoveRow,
    ROW_LENGTH,
    type HydratedYinshGameState
} from '@tabletop/yinsh'
import type { YinshGameSession } from '$lib/model/session.svelte.js'
import { boardDiff, ringReturned, ringTaken, type BoardDiff } from '$lib/board/boardDiff.js'
import { removedRings, ringSeed, type RemovedRings } from '$lib/board/ringSeeds.js'
import { coordsKey, flatCenter, SPACING, VIEW } from '$lib/board/geometry.js'
import { flightPose, progressAt } from '$lib/board/ringFlight.js'
import { flipPose } from '$lib/board/flipPose.js'
import { MARKER_HEIGHT, MARKER_RADIUS, RING_HEIGHT } from '$lib/board/pieceGeometry.js'
import { DROP, MARKER_DROP } from '$lib/board/dropIn.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A ring's flight takes a little longer the farther it goes.
const FLIGHT = { base: 0.5, perSpace: 0.03 }
// A removed ring's flight to its space grows with the square root of the distance, so one from
// the far side takes longer than one from nearby without dragging: about 0.6 s from two or three
// spaces away, 0.7 s from ten.
const TAKE = { base: 0.5, perRootSpace: 0.065 }
// Markers the ring passes are blown over just behind it, tossed up a little as they turn.
const FLIP = { wake: 0.03, duration: 0.3, hop: 5 }
// Taken markers float straight up one after another as they fade, their shadows shrinking.
const LIFT = { duration: 0.35, rise: -34, scale: 1.02, stagger: 0.03 }
const MARK_FADE = 0.2
const QUICK = 0.18
const QUICK_STAGGER = 0.008

export type DrawnPiece = {
    key: string
    kind: 'ring' | 'marker'
    coords: AxialCoordinates
    playerId: string
    // What its specks are seeded by: a ring's id where it has one, so they move with it.
    seed: string
    // A marker turning over shows this player's face once it has flipped.
    flip?: { toPlayerId: string }
}

// The ring in flight, drawn above the board at the point it leaves. `leaves` is the key of the
// marker it leaves in its hole, which it lifts off over.
export type Flier = {
    at: Point
    playerId: string
    seed: string
    leaves?: string
}

export type FlipPart = 'before' | 'turning' | 'side' | 'face' | 'upper' | 'lower' | 'after'

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedYinshGameState, AnimationContext>
type FlierParts = {
    node?: SVGGElement
    body?: SVGGElement
    shadow?: SVGGElement
    nearNode?: SVGGElement
    nearBody?: SVGGElement
    left?: SVGUseElement
}

export function pieceKey(kind: DrawnPiece['kind'], coords: AxialCoordinates): string {
    return `${kind}-${coordsKey(coords)}`
}

// An id for a piece's drawing, which occluders and the flier copy.
export function pieceId(key: string): string {
    return `yinsh-${key.replace(',', '_')}`
}

function drawnPieces(state: HydratedYinshGameState): DrawnPiece[] {
    return state.board.points.flatMap((point): DrawnPiece[] => [
        ...(point.markerPlayerId === undefined
            ? []
            : [
                  {
                      key: pieceKey('marker', point.coords),
                      kind: 'marker' as const,
                      coords: point.coords,
                      playerId: point.markerPlayerId,
                      // Markers stay on their point until taken, so the point serves as their
                      // identity.
                      seed: coordsKey(point.coords)
                  }
              ]),
        ...(point.ringPlayerId === undefined
            ? []
            : [
                  {
                      key: pieceKey('ring', point.coords),
                      kind: 'ring' as const,
                      coords: point.coords,
                      playerId: point.ringPlayerId,
                      seed: ringSeed(point.ringId, point.coords)
                  }
              ])
    ])
}

export class BoardAnimator {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    pieces: DrawnPiece[] = $derived.by(() => drawnPieces(this.session.gameState))
    removed: RemovedRings = $derived.by(() => removedRings(this.session.gameState))
    flier: Flier | undefined = $state()

    private readonly nodes = new Map<string, SVGGElement>()
    private readonly flipParts = new Map<string, Partial<Record<FlipPart, SVGElement>>>()
    private flierParts: FlierParts = {}
    // The marks fade with the move: the destination spots' layer and each piece's own marks.
    private readonly markNodes = new Set<SVGGElement>()
    // Copies of the pieces drawn over the flier, each with its point's distance down the screen.
    private readonly occluders = new Map<SVGUseElement, number>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: YinshGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    node(key: string): Attachment<SVGGElement> {
        return (element) => {
            gsap.set(element, { svgOrigin: '0 0' })
            this.nodes.set(key, element)
            return () => {
                if (this.nodes.get(key) === element) this.nodes.delete(key)
            }
        }
    }

    flipPart(key: string): (name: FlipPart) => Attachment<SVGElement> {
        return (name) => (element) => {
            const parts = this.flipParts.get(key) ?? {}
            parts[name] = element
            this.flipParts.set(key, parts)
            return () => {
                const current = this.flipParts.get(key)
                if (current?.[name] === element) delete current[name]
            }
        }
    }

    flierPart(name: keyof FlierParts): Attachment<SVGGElement | SVGUseElement> {
        return (element) => {
            gsap.set(element, { svgOrigin: '0 0' })
            ;(this.flierParts as Record<string, Element>)[name] = element
            return () => {
                if (this.flierParts[name] === element) delete this.flierParts[name]
            }
        }
    }

    // A copy of the piece at screen depth `y`, drawn over the flier while the flier is low and
    // behind it.
    occluder(y: number): Attachment<SVGUseElement> {
        return (element) => {
            element.style.visibility = 'hidden'
            this.occluders.set(element, y)
            return () => {
                this.occluders.delete(element)
            }
        }
    }

    marks(): Attachment<SVGGElement> {
        return (element) => {
            this.markNodes.add(element)
            return () => {
                this.markNodes.delete(element)
            }
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const timeline = animationContext.actionTimeline
        // Each point's drawing is reused for whatever piece next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGElement[] = []
        const diff = boardDiff(from.board, to.board)
        const quick = action === undefined

        this.pieces = this.inBetween(from, diff)
        this.flier = this.flierFor(from, to, diff, action)
        // A ring taken back from its slot leaves it as it flies; one taken lands there first.
        const before = removedRings(from)
        const after = removedRings(to)
        this.removed = Object.fromEntries(
            Object.entries(before).map(([playerId, seeds]) => [
                playerId,
                seeds.length <= (after[playerId]?.length ?? 0) ? seeds : after[playerId]
            ])
        )
        if (this.flier !== undefined) {
            const leaving = this.flierStart(from, to, diff, action)
            this.pieces = this.pieces.filter(
                (piece) =>
                    !(piece.kind === 'ring' && leaving && sameCoordinates(piece.coords, leaving))
            )
        }
        await tick()

        if (isPlaceRing(action)) {
            this.drop(pieceKey('ring', action.coords), timeline, touched, DROP, 0)
        } else if (isMoveRing(action)) {
            // The mover's own marker already dropped into the ring as a staged preview.
            const start = kind === 'own-action' ? 0 : MARKER_DROP.fall + MARKER_DROP.settle * 2
            if (kind !== 'own-action') {
                this.drop(pieceKey('marker', action.from), timeline, touched, MARKER_DROP, 0)
            }
            this.moveRing(action.from, action.to, diff, timeline, touched, start, false)
        } else if (isRemoveRow(action)) {
            action.metadata?.markers.forEach((coords, index) => {
                this.liftAway(
                    pieceKey('marker', coords),
                    timeline,
                    touched,
                    LIFT.duration,
                    index * LIFT.stagger
                )
            })
        } else if (isRemoveRing(action)) {
            const slot = this.slotOf(
                action.playerId,
                to.getPlayerState(action.playerId).ringsRemoved - 1
            )
            const start = flatCenter(action.coords)
            const spaces = Math.hypot(slot.x - start.x, slot.y - start.y) / SPACING
            const duration = TAKE.base + TAKE.perRootSpace * Math.sqrt(spaces)
            this.fly(start, slot, timeline, 0, duration, false)
        } else if (quick) {
            this.fallback(from, to, diff, timeline, touched)
        }
        if (this.markNodes.size > 0) {
            timeline.to([...this.markNodes], { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        animationContext.afterAnimations(() => {
            this.pieces = drawnPieces(to)
            this.removed = removedRings(to)
            this.flier = undefined
            for (const node of touched) {
                gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            }
            for (const marks of this.markNodes) gsap.set(marks, { opacity: 1 })
        })
    }

    // The board partway: the `from` pieces, with markers about to turn showing both faces, and
    // every arriving piece drawn so it can come in.
    private inBetween(from: HydratedYinshGameState, diff: BoardDiff): DrawnPiece[] {
        const kept = drawnPieces(from).map((piece): DrawnPiece => {
            const flip = diff.flipped.find((marker) => sameCoordinates(marker.coords, piece.coords))
            return flip && piece.kind === 'marker'
                ? { ...piece, flip: { toPlayerId: flip.toPlayerId } }
                : piece
        })
        const arriving = [
            ...diff.markersCome.map((marker) => ({
                ...marker,
                kind: 'marker' as const,
                seed: coordsKey(marker.coords)
            })),
            ...diff.ringsCome.map((ring) => ({
                ...ring,
                kind: 'ring' as const,
                seed: ringSeed(undefined, ring.coords)
            }))
        ].map((piece) => ({ ...piece, key: pieceKey(piece.kind, piece.coords) }))
        return [...kept, ...arriving]
    }

    // The point a flying ring leaves, if it leaves one.
    private flierStart(
        from: HydratedYinshGameState,
        to: HydratedYinshGameState,
        diff: BoardDiff,
        action: Step['action']
    ): AxialCoordinates | undefined {
        if (isRemoveRing(action)) return action.coords
        if (diff.movedRing) return diff.movedRing.from
        if (action === undefined) return ringTaken(from, to)?.coords
        return undefined
    }

    private flierFor(
        from: HydratedYinshGameState,
        to: HydratedYinshGameState,
        diff: BoardDiff,
        action: Step['action']
    ): Flier | undefined {
        const ringAt = (coords: AxialCoordinates, playerId: string): Flier => ({
            at: VIEW.center(coords),
            playerId,
            seed: ringSeed(from.board.ringIdAt(coords), coords)
        })
        if (isRemoveRing(action)) return ringAt(action.coords, action.playerId)
        if (diff.movedRing) {
            const start = diff.movedRing.from
            // Going forward the ring leaves a marker in its hole; taken back, it leaves none.
            const leaves =
                to.board.markerAt(start) === undefined ? undefined : pieceKey('marker', start)
            return { ...ringAt(start, diff.movedRing.playerId), leaves }
        }
        if (action !== undefined) return undefined
        const taken = ringTaken(from, to)
        if (taken) return ringAt(taken.coords, taken.playerId)
        const returned = ringReturned(from, to)
        if (returned) {
            const index = to.getPlayerState(returned.playerId).ringsRemoved
            const slot = VIEW.project(this.slotOf(returned.playerId, index))
            return {
                at: slot,
                playerId: returned.playerId,
                seed: removedRings(from)[returned.playerId][index]
            }
        }
        return undefined
    }

    // Undo and history steps carry no action: everything moves at once, quickly, read from the
    // two boards.
    private fallback(
        from: HydratedYinshGameState,
        to: HydratedYinshGameState,
        diff: BoardDiff,
        timeline: Timeline,
        touched: SVGElement[]
    ) {
        if (diff.movedRing) {
            this.moveRing(diff.movedRing.from, diff.movedRing.to, diff, timeline, touched, 0, true)
        }
        const taken = ringTaken(from, to)
        const returned = ringReturned(from, to)
        if (taken) {
            const slot = this.slotOf(
                taken.playerId,
                to.getPlayerState(taken.playerId).ringsRemoved - 1
            )
            this.fly(flatCenter(taken.coords), slot, timeline, 0, QUICK, true)
        }
        if (returned) {
            const index = to.getPlayerState(returned.playerId).ringsRemoved
            this.fly(
                this.slotOf(returned.playerId, index),
                flatCenter(returned.coords),
                timeline,
                0,
                QUICK,
                true
            )
            // The flier lands where the ring is drawn arriving.
            const node = this.nodes.get(pieceKey('ring', returned.coords))
            if (node) {
                touched.push(node)
                timeline.set(node, { opacity: 0 }, 0)
            }
        }
        const quickDrop = { ...DROP, fall: QUICK, bounce: 0 }
        for (const ring of diff.ringsCome) {
            if (returned && sameCoordinates(ring.coords, returned.coords)) continue
            this.drop(pieceKey('ring', ring.coords), timeline, touched, quickDrop, 0)
        }
        for (const ring of diff.ringsGone) {
            if (taken && sameCoordinates(ring.coords, taken.coords)) continue
            this.liftAway(pieceKey('ring', ring.coords), timeline, touched, QUICK, 0, DROP.rise)
        }
        // Markers come back the way a taken row leaves, only quicker: they drop in one after
        // another, and markers taken lift away.
        const settle = QUICK - QUICK_STAGGER * (ROW_LENGTH - 1)
        diff.markersCome.forEach((marker, index) => {
            this.drop(
                pieceKey('marker', marker.coords),
                timeline,
                touched,
                {
                    ...MARKER_DROP,
                    rise: LIFT.rise,
                    fall: settle,
                    bounce: 0
                },
                (index % ROW_LENGTH) * QUICK_STAGGER
            )
        })
        diff.markersGone.forEach((marker, index) => {
            this.liftAway(
                pieceKey('marker', marker.coords),
                timeline,
                touched,
                settle,
                (index % ROW_LENGTH) * QUICK_STAGGER
            )
        })
    }

    // The ring lifts off over the marker left in its hole and flies to its point, blowing over
    // every marker it passes just behind it.
    private moveRing(
        from: AxialCoordinates,
        to: AxialCoordinates,
        diff: BoardDiff,
        timeline: Timeline,
        touched: SVGElement[],
        at: number,
        quick: boolean
    ) {
        const start = flatCenter(from)
        const end = flatCenter(to)
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        const duration = quick ? QUICK : FLIGHT.base + (FLIGHT.perSpace * length) / SPACING
        this.fly(start, end, timeline, at, duration, quick)
        const travel = { x: end.x - start.x, y: end.y - start.y }
        const flipDuration = quick ? QUICK : FLIP.duration
        for (const marker of diff.flipped) {
            const point = flatCenter(marker.coords)
            const distance = Math.hypot(point.x - start.x, point.y - start.y)
            const passed = at + duration * progressAt(distance, length, quick)
            const begin = quick ? 0 : passed + FLIP.wake
            this.flip(
                pieceKey('marker', marker.coords),
                travel,
                timeline,
                begin,
                flipDuration,
                touched
            )
        }
    }

    // Flies the flier from `from` to `to` on the board's plane: its node follows the ground, its
    // body rises above it, and its shadow stays on the ground, paling as the ring rises.
    private fly(
        from: Point,
        to: Point,
        timeline: Timeline,
        at: number,
        duration: number,
        quick: boolean
    ) {
        const { node, body, shadow, nearNode, nearBody, left } = this.flierParts
        if (node === undefined || body === undefined || shadow === undefined) return
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const direction = { x: (to.x - from.x) / (length || 1), y: (to.y - from.y) / (length || 1) }
        const anchor = VIEW.project(from)
        const ground = (along: number) =>
            VIEW.project({ x: from.x + direction.x * along, y: from.y + direction.y * along })
        const pose = (u: number) => {
            const { along, lift, scale } = flightPose(u, length, quick)
            const point = ground(along)
            const x = point.x - anchor.x
            const y = point.y - anchor.y
            const rise = -VIEW.height(lift)
            for (const n of [node, nearNode]) if (n) gsap.set(n, { x, y })
            for (const b of [body, nearBody]) if (b) gsap.set(b, { y: rise, scale })
            gsap.set(shadow, {
                opacity: Math.max(0.35, 1 - lift / 40),
                scale: 1 - Math.min(0.2, lift / 150)
            })
            // The marker left behind sits in the hole until the ring clears it.
            const low = lift < MARKER_HEIGHT
            if (left) left.style.visibility = low && along === 0 ? 'visible' : 'hidden'
            if (nearNode) nearNode.style.visibility = low && along === 0 ? 'visible' : 'hidden'
            this.occlude(anchor.y + y, lift)
        }
        pose(0)
        const progress = { u: 0 }
        timeline.to(
            progress,
            { u: 1, duration, ease: 'none', onUpdate: () => pose(progress.u) },
            at
        )
    }

    // Pieces nearer the viewer than the flier stand in front of it while it is lower than they
    // are tall; once it is higher it passes over them.
    private occlude(ground: number, lift: number) {
        for (const [use, y] of this.occluders) {
            use.style.visibility = y > ground + 0.5 && lift < RING_HEIGHT ? 'visible' : 'hidden'
        }
    }

    // The marker turns over along the ring's path, tossed up as it goes; its shadow pales under it.
    private flip(
        key: string,
        travel: Point,
        timeline: Timeline,
        at: number,
        duration: number,
        touched: SVGElement[]
    ) {
        const parts = this.flipParts.get(key)
        const shadow = this.nodes.get(`${key}:shadow`)
        if (parts === undefined) return
        const { before, turning, side, face, upper, lower, after } = parts
        if (!before || !turning || !side || !face || !upper || !lower || !after) return
        const show = (element: SVGElement, shown: boolean) =>
            element.setAttribute('visibility', shown ? 'visible' : 'hidden')
        const pose = (turn: number) => {
            const drawn = flipPose(VIEW, {
                radius: MARKER_RADIUS,
                height: MARKER_HEIGHT,
                travel,
                turn,
                hop: FLIP.hop
            })
            side.setAttribute('d', drawn.side)
            face.setAttribute('transform', drawn.face)
            show(upper, drawn.upperFace)
            show(lower, !drawn.upperFace)
        }
        const progress = { turn: 0 }
        timeline.to(
            progress,
            {
                turn: Math.PI,
                duration,
                ease: 'sine.inOut',
                onStart: () => {
                    show(before, false)
                    show(turning, true)
                    pose(0)
                },
                onUpdate: () => pose(progress.turn),
                onComplete: () => {
                    show(turning, false)
                    show(after, true)
                }
            },
            at
        )
        if (shadow) {
            touched.push(shadow)
            timeline.to(
                shadow,
                { opacity: 0.4, scale: 0.9, duration: duration / 2, ease: 'sine.out' },
                at
            )
            timeline.to(
                shadow,
                { opacity: 1, scale: 1, duration: duration / 2, ease: 'sine.in' },
                at + duration / 2
            )
        }
    }

    // A piece falls onto its point, gathering speed, and settles with a small bounce; its shadow
    // waits on the board, small and faint, and darkens as the piece comes down.
    private drop(
        key: string,
        timeline: Timeline,
        touched: SVGElement[],
        motion: typeof DROP,
        at: number
    ) {
        const body = this.nodes.get(key)
        const shadow = this.nodes.get(`${key}:shadow`)
        if (body !== undefined) {
            touched.push(body)
            timeline.fromTo(
                body,
                { opacity: 0, scale: motion.scale, y: motion.rise },
                { opacity: 1, duration: motion.fall * 0.25, ease: 'none', immediateRender: true },
                at
            )
            timeline.to(body, { scale: 1, y: 0, duration: motion.fall, ease: 'power2.in' }, at)
            if (motion.bounce !== 0) {
                const landed = at + motion.fall
                timeline.to(
                    body,
                    { y: motion.bounce, duration: motion.settle, ease: 'power1.out' },
                    landed
                )
                timeline.to(
                    body,
                    { y: 0, duration: motion.settle, ease: 'power1.in' },
                    landed + motion.settle
                )
            }
        }
        if (shadow !== undefined) {
            touched.push(shadow)
            timeline.fromTo(
                shadow,
                { opacity: 0, scale: motion.shadow },
                {
                    opacity: 1,
                    scale: 1,
                    duration: motion.fall,
                    ease: 'power2.in',
                    immediateRender: true
                },
                at
            )
        }
    }

    // A piece floats straight up off the board as it fades; its shadow shrinks where it lay.
    private liftAway(
        key: string,
        timeline: Timeline,
        touched: SVGElement[],
        duration: number,
        at: number,
        rise = LIFT.rise
    ) {
        const body = this.nodes.get(key)
        const shadow = this.nodes.get(`${key}:shadow`)
        if (body !== undefined) {
            touched.push(body)
            timeline.to(
                body,
                { opacity: 0, y: rise, scale: LIFT.scale, duration, ease: 'power1.out' },
                at
            )
        }
        if (shadow !== undefined) {
            touched.push(shadow)
            timeline.to(shadow, { opacity: 0, scale: 0.7, duration, ease: 'power1.out' }, at)
        }
    }

    // A removed ring's slot, on the board's plane.
    private slotOf(playerId: string, index: number): Point {
        const side = playerId === this.session.topPlayerId ? 'top' : 'bottom'
        const slot = VIEW.ringSlots(side)[index]
        return { x: slot.x, y: slot.y / VIEW.tilt }
    }
}
