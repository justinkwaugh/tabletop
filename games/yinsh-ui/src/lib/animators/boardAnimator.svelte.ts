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
    pointKey,
    pointsBetween,
    ROW_LENGTH,
    type HydratedYinshGameState,
    type Ring
} from '@tabletop/yinsh'
import type { MoveInterrupter, YinshGameSession } from '$lib/model/session.svelte.js'
import {
    boardDiff,
    ringsReturned,
    ringsTaken,
    type BoardDiff,
    type MovedRing,
    type SpacedRing
} from '$lib/board/boardDiff.js'
import { markerSeed, removedRings, ringSeed, type RemovedRings } from '$lib/board/ringSeeds.js'
import { flatCenter, flatRingSlots, SPACING, VIEW } from '$lib/board/geometry.js'
import { flightPose, progressAt } from '$lib/board/ringFlight.js'
import { flipPose } from '$lib/board/flipPose.js'
import { MARKER_HEIGHT, MARKER_RADIUS, RING_HEIGHT } from '$lib/board/pieceGeometry.js'
import { DROP, MARKER_DROP, STAGED_DROP, stagedDropPose } from '$lib/board/dropIn.js'
import { poseOf, setPose } from './svgPose.js'

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
    // What its specks are seeded by: a ring's id, a marker's point.
    seed: string
    // A marker turning over shows this player's face once it has flipped.
    flip?: { toPlayerId: string }
}

// A ring in flight, drawn above the board at the point it leaves. `leaves` is the key of the
// marker it leaves in its hole, which it lifts off over.
export type Flier = {
    key: string
    ringId: number
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
export type FlierPart = keyof FlierParts

export function pieceKey(kind: DrawnPiece['kind'], coords: AxialCoordinates): string {
    return `${kind}-${pointKey(coords)}`
}

export function flierKey(ringId: number): string {
    return `flier-${ringId}`
}

// An id for a piece's drawing, which occluders and the flier copy.
export function pieceId(key: string): string {
    return `yinsh-${key}`
}

export class BoardAnimator implements MoveInterrupter {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    pieces: DrawnPiece[] = $derived.by(() => this.drawnPieces(this.session.gameState))
    removed: RemovedRings = $derived.by(() => removedRings(this.session.gameState))
    fliers: Flier[] = $state([])

    private readonly nodes = new Map<string, SVGGElement>()
    private readonly flipParts = new Map<string, Partial<Record<FlipPart, SVGElement>>>()
    private readonly flierParts = new Map<string, FlierParts>()
    // The marks fade with the move: each destination spot and each piece's own marks.
    private readonly markNodes = new Set<SVGElement>()
    // Copies of the pieces drawn over the flier, each with its point's distance down the screen.
    private readonly occluders = new Map<SVGUseElement, number>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    // What the move playing tweens, and how to put the board as it leaves it.
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedYinshGameState | undefined

    constructor(private readonly session: YinshGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupter = this
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            if (this.session.moveInterrupter === this) this.session.moveInterrupter = undefined
        }
    }

    // A switch of view, such as a reload after a rejected move, shows another state at once: the
    // move stops where it is and the rest of its replay is dropped.
    abandon() {
        if (this.landMove === undefined) return
        this.interrupt()
        this.abandoned = this.session.presentingState
    }

    // Turning the board lands the move playing, as its motion was laid out in the old view.
    interrupt() {
        const land = this.landMove
        if (land === undefined) return
        gsap.killTweensOf([...this.tweened])
        land()
    }

    node(key: string): Attachment<SVGGElement> {
        return (element) => {
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
                if (current && Object.keys(current).length === 0) this.flipParts.delete(key)
            }
        }
    }

    flierPart(flier: string, name: Exclude<FlierPart, 'left'>): Attachment<SVGGElement> {
        return (element) => this.attachFlierPart(flier, (parts) => (parts[name] = element), name)
    }

    flierLeft(flier: string): Attachment<SVGUseElement> {
        return (element) => this.attachFlierPart(flier, (parts) => (parts.left = element), 'left')
    }

    private attachFlierPart(flier: string, set: (parts: FlierParts) => void, name: FlierPart) {
        const parts = this.flierParts.get(flier) ?? {}
        set(parts)
        this.flierParts.set(flier, parts)
        const element = parts[name]
        return () => {
            const current = this.flierParts.get(flier)
            if (current === undefined || current[name] !== element) return
            delete current[name]
            if (Object.keys(current).length === 0) this.flierParts.delete(flier)
        }
    }

    // A copy of the piece at screen depth `y`, drawn over the flier while the flier is low and
    // behind it. Copies are hidden with `display`, not `visibility`: a turning marker's parts set
    // `visibility="visible"` on themselves, which would show through a hidden copy, above the flier.
    occluder(y: number): Attachment<SVGUseElement> {
        return (element) => {
            element.style.display = 'none'
            this.occluders.set(element, y)
            return () => {
                this.occluders.delete(element)
            }
        }
    }

    marks(): Attachment<SVGElement> {
        return (element) => {
            this.markNodes.add(element)
            return () => {
                this.markNodes.delete(element)
            }
        }
    }

    private drawnPieces(state: HydratedYinshGameState): DrawnPiece[] {
        return [
            ...state.board.markers.map((marker) =>
                this.markerPiece(marker.coords, marker.playerId)
            ),
            ...state.board.rings.map((ring) => this.ringPiece(ring))
        ]
    }

    private markerPiece(coords: AxialCoordinates, playerId: string): DrawnPiece {
        return {
            key: pieceKey('marker', coords),
            kind: 'marker',
            coords,
            playerId,
            seed: markerSeed(coords)
        }
    }

    private ringPiece(ring: Ring): DrawnPiece {
        return {
            key: pieceKey('ring', ring.coords),
            kind: 'ring',
            coords: ring.coords,
            playerId: ring.playerId,
            seed: ringSeed(ring.id)
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) {
            return
        }
        this.abandoned = undefined
        const timeline = animationContext.actionTimeline
        const shown = this.session.gameState
        // Each point's drawing is reused for whatever piece next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGElement[] = []
        const diff = boardDiff(from.board, to.board)
        const taken = ringsTaken(from, to)
        const returned = ringsReturned(from, to)
        const quick = action === undefined

        this.fliers = this.fliersFor(to, diff, taken, returned, action)
        this.pieces = this.inBetween(from, diff, this.fliers)
        // A ring taken back from its slot leaves it as it flies; one taken lands there first.
        const before = removedRings(from)
        const after = removedRings(to)
        this.removed = Object.fromEntries(
            Object.entries(before).map(([playerId, seeds]) => [
                playerId,
                seeds.length <= (after[playerId]?.length ?? 0) ? seeds : after[playerId]
            ])
        )
        await tick()

        if (isPlaceRing(action)) {
            this.drop(pieceKey('ring', action.coords), timeline, touched, DROP, 0)
        } else if (isMoveRing(action)) {
            const marker = pieceKey('marker', action.from)
            let start: number
            if (kind === 'own-action') {
                // The mover's own marker dropped into the ring as a staged preview; a move made
                // while it was still falling carries it the rest of the way.
                const left = this.session.stagedDropLeft()
                this.finishStagedDrop(marker, timeline, touched, left)
                start = left
            } else {
                this.drop(marker, timeline, touched, MARKER_DROP, 0)
                start = MARKER_DROP.fall + MARKER_DROP.settle * 2
            }
            const moved = diff.movedRings[0]
            this.moveRing(moved, diff.flipped, timeline, touched, start, false)
        } else if (isRemoveRow(action)) {
            const markers = pointsBetween(action.from, action.to) ?? []
            markers.forEach((coords, index) => {
                this.liftAway(
                    pieceKey('marker', coords),
                    timeline,
                    touched,
                    LIFT.duration,
                    index * LIFT.stagger
                )
            })
        } else if (isRemoveRing(action)) {
            for (const { ring, slot: index } of taken) {
                const slot = this.slotOf(ring.playerId, index)
                const start = flatCenter(ring.coords)
                const spaces = Math.hypot(slot.x - start.x, slot.y - start.y) / SPACING
                const duration = TAKE.base + TAKE.perRootSpace * Math.sqrt(spaces)
                this.fly(flierKey(ring.id), start, slot, timeline, 0, duration, false)
            }
        } else if (quick) {
            this.fallback(to, diff, taken, returned, timeline, touched)
        }
        if (this.markNodes.size > 0) {
            const marks = [...this.markNodes]
            this.tweened.add(marks)
            timeline.to(marks, { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            this.tweened.clear()
            this.fliers = []
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            for (const marks of this.markNodes) gsap.set(marks, { opacity: 1 })
            // A switch of view while the move played, such as a reload after a rejected move,
            // has already shown another state, which this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.pieces = this.drawnPieces(to)
            this.removed = removedRings(to)
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // The board partway: the `from` pieces, with markers about to turn showing both faces, and
    // every arriving piece drawn so it can come in. A ring in flight is drawn by its flier until
    // it lands.
    private inBetween(
        from: HydratedYinshGameState,
        diff: BoardDiff,
        fliers: readonly Flier[]
    ): DrawnPiece[] {
        const flying = new Set(fliers.map((flier) => flier.ringId))
        const markers = from.board.markers.map((marker): DrawnPiece => {
            const piece = this.markerPiece(marker.coords, marker.playerId)
            const flip = diff.flipped.find((other) => sameCoordinates(other.coords, marker.coords))
            return flip ? { ...piece, flip: { toPlayerId: flip.toPlayerId } } : piece
        })
        const rings = [...from.board.rings, ...diff.ringsCome]
            .filter((ring) => !flying.has(ring.id))
            .map((ring) => this.ringPiece(ring))
        return [
            ...markers,
            ...diff.markersCome.map((marker) => this.markerPiece(marker.coords, marker.playerId)),
            ...rings
        ]
    }

    // Every ring that flies: each moved ring, each taken off to its space and each taken back
    // from it.
    private fliersFor(
        to: HydratedYinshGameState,
        diff: BoardDiff,
        taken: readonly SpacedRing[],
        returned: readonly SpacedRing[],
        action: Step['action']
    ): Flier[] {
        if (isPlaceRing(action) || isRemoveRow(action)) return []
        const flier = (ring: Ring, at: Point): Flier => ({
            key: flierKey(ring.id),
            ringId: ring.id,
            at,
            playerId: ring.playerId,
            seed: ringSeed(ring.id)
        })
        const moved = diff.movedRings.map((move): Flier => {
            const ring = { coords: move.from, playerId: move.playerId, id: move.id }
            // Going forward the ring leaves a marker in its hole; taken back, it leaves none.
            const leaves =
                to.board.markerAt(move.from) === undefined
                    ? undefined
                    : pieceKey('marker', move.from)
            return { ...flier(ring, this.session.view.center(move.from)), leaves }
        })
        return [
            ...moved,
            ...taken.map(({ ring }) => flier(ring, this.session.view.center(ring.coords))),
            ...returned.map(({ ring, slot }) =>
                flier(ring, this.session.view.project(this.slotOf(ring.playerId, slot)))
            )
        ]
    }

    // Undo and history steps carry no action: everything moves at once, quickly, read from the
    // two boards, however many actions lie between them.
    private fallback(
        to: HydratedYinshGameState,
        diff: BoardDiff,
        taken: readonly SpacedRing[],
        returned: readonly SpacedRing[],
        timeline: Timeline,
        touched: SVGElement[]
    ) {
        for (const move of diff.movedRings) {
            const start = flatCenter(move.from)
            const end = flatCenter(move.to)
            this.fly(flierKey(move.id), start, end, timeline, 0, QUICK, true)
        }
        // Each flipped marker turns along the path of a ring that passed it.
        for (const marker of diff.flipped) {
            const passer = diff.movedRings.find((move) =>
                pointsBetween(move.from, move.to)?.some((coords) =>
                    sameCoordinates(coords, marker.coords)
                )
            )
            const travel = passer ? this.travel(passer) : { x: 0, y: 1 }
            this.flip(pieceKey('marker', marker.coords), travel, timeline, 0, QUICK, touched)
        }
        for (const { ring, slot } of taken) {
            const target = this.slotOf(ring.playerId, slot)
            this.fly(flierKey(ring.id), flatCenter(ring.coords), target, timeline, 0, QUICK, true)
        }
        for (const { ring, slot } of returned) {
            const start = this.slotOf(ring.playerId, slot)
            this.fly(flierKey(ring.id), start, flatCenter(ring.coords), timeline, 0, QUICK, true)
        }
        const quickDrop = { ...DROP, fall: QUICK, bounce: 0 }
        for (const ring of diff.ringsCome) {
            if (returned.some((entry) => entry.ring.id === ring.id)) continue
            this.drop(pieceKey('ring', ring.coords), timeline, touched, quickDrop, 0)
        }
        for (const ring of diff.ringsGone) {
            if (taken.some((entry) => entry.ring.id === ring.id)) continue
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
        // A move taken back leaves its marker standing: the ring lands back around it, chosen.
        const gone = diff.markersGone.filter(
            (marker) => !this.session.keepsMarker(to, marker.coords)
        )
        gone.forEach((marker, index) => {
            this.liftAway(
                pieceKey('marker', marker.coords),
                timeline,
                touched,
                settle,
                (index % ROW_LENGTH) * QUICK_STAGGER
            )
        })
    }

    private travel(move: MovedRing): Point {
        const start = flatCenter(move.from)
        const end = flatCenter(move.to)
        return { x: end.x - start.x, y: end.y - start.y }
    }

    // The ring lifts off over the marker left in its hole and flies to its point, blowing over
    // every marker it passes just behind it.
    private moveRing(
        move: MovedRing,
        flipped: BoardDiff['flipped'],
        timeline: Timeline,
        touched: SVGElement[],
        at: number,
        quick: boolean
    ) {
        const start = flatCenter(move.from)
        const end = flatCenter(move.to)
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        const duration = quick ? QUICK : FLIGHT.base + (FLIGHT.perSpace * length) / SPACING
        this.fly(flierKey(move.id), start, end, timeline, at, duration, quick)
        const flipDuration = quick ? QUICK : FLIP.duration
        for (const marker of flipped) {
            const point = flatCenter(marker.coords)
            const distance = Math.hypot(point.x - start.x, point.y - start.y)
            const passed = at + duration * progressAt(distance, length, quick)
            const begin = quick ? 0 : passed + FLIP.wake
            this.flip(
                pieceKey('marker', marker.coords),
                this.travel(move),
                timeline,
                begin,
                flipDuration,
                touched
            )
        }
    }

    // Flies a flier from `from` to `to` on the board's plane: its node follows the ground, its
    // body rises above it, and its shadow stays on the ground, paling as the ring rises.
    private fly(
        key: string,
        from: Point,
        to: Point,
        timeline: Timeline,
        at: number,
        duration: number,
        quick: boolean
    ) {
        const parts = this.flierParts.get(key)
        if (parts === undefined) return
        const { node, body, shadow, nearNode, nearBody, left } = parts
        if (node === undefined || body === undefined || shadow === undefined) return
        // Pieces in front cover a flier only while it is the one in the air.
        const occludes = this.fliers.length === 1
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const direction = { x: (to.x - from.x) / (length || 1), y: (to.y - from.y) / (length || 1) }
        const view = this.session.view
        const anchor = view.project(from)
        const ground = (along: number) =>
            view.project({ x: from.x + direction.x * along, y: from.y + direction.y * along })
        const pose = (u: number) => {
            const { along, lift, scale } = flightPose(u, length, quick)
            const point = ground(along)
            const x = point.x - anchor.x
            const y = point.y - anchor.y
            const rise = -VIEW.height(lift)
            for (const n of [node, nearNode]) if (n) setPose(n, { x, y })
            for (const b of [body, nearBody]) if (b) setPose(b, { y: rise, scale })
            setPose(shadow, { scale: 1 - Math.min(0.2, lift / 150) })
            shadow.style.opacity = String(Math.max(0.35, 1 - lift / 40))
            // The marker left behind sits in the hole until the ring clears it.
            const low = lift < MARKER_HEIGHT
            if (left) left.style.display = low && along === 0 ? '' : 'none'
            if (nearNode) nearNode.style.visibility = low && along === 0 ? 'visible' : 'hidden'
            if (occludes) this.occlude(anchor.y + y, lift)
        }
        pose(0)
        const progress = {
            get u() {
                return this.at
            },
            set u(u: number) {
                this.at = u
                pose(u)
            },
            at: 0
        }
        this.tweened.add(progress)
        timeline.to(progress, { u: 1, duration, ease: 'none' }, at)
    }

    // Pieces nearer the viewer than the flier stand in front of it while it is lower than they
    // are tall; once it is higher it passes over them.
    private occlude(ground: number, lift: number) {
        for (const [use, y] of this.occluders) {
            use.style.display = y > ground + 0.5 && lift < RING_HEIGHT ? '' : 'none'
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
        // The flip is drawn at the board's tilt along the path as seen, turned with the board.
        const turned = this.session.view.turn(travel)
        // Before the turn, during it, and once it is over, as a seek can land anywhere.
        const pose = (turn: number) => {
            show(before, turn <= 0)
            show(turning, turn > 0 && turn < Math.PI)
            show(after, turn >= Math.PI)
            if (turn <= 0 || turn >= Math.PI) return
            const drawn = flipPose(VIEW, {
                radius: MARKER_RADIUS,
                height: MARKER_HEIGHT,
                travel: turned,
                turn,
                hop: FLIP.hop
            })
            side.setAttribute('d', drawn.side)
            face.setAttribute('transform', drawn.face)
            show(upper, drawn.upperFace)
            show(lower, !drawn.upperFace)
        }
        const progress = {
            get turn() {
                return this.at
            },
            set turn(turn: number) {
                this.at = turn
                pose(turn)
            },
            at: 0
        }
        this.tweened.add(progress)
        timeline.to(progress, { turn: Math.PI, duration, ease: 'sine.inOut' }, at)
        if (shadow) {
            touched.push(shadow)
            const shadowPose = poseOf(shadow)
            this.tweened.add(shadowPose).add(shadow)
            timeline.to(shadowPose, { scale: 0.9, duration: duration / 2, ease: 'sine.out' }, at)
            timeline.to(shadow, { opacity: 0.4, duration: duration / 2, ease: 'sine.out' }, at)
            const half = at + duration / 2
            timeline.to(shadowPose, { scale: 1, duration: duration / 2, ease: 'sine.in' }, half)
            timeline.to(shadow, { opacity: 1, duration: duration / 2, ease: 'sine.in' }, half)
        }
    }

    // The committed marker, which the staged one stood for, finishes the staged drop from where
    // it has got to.
    private finishStagedDrop(key: string, timeline: Timeline, touched: SVGElement[], left: number) {
        const body = this.nodes.get(key)
        if (body === undefined || left <= 0) return
        touched.push(body)
        const progress = {
            get time() {
                return this.at
            },
            set time(time: number) {
                this.at = time
                const { y, scale, opacity } = stagedDropPose(time)
                setPose(body, { y, scale })
                body.style.opacity = String(opacity)
            },
            at: 0
        }
        progress.time = STAGED_DROP - left
        this.tweened.add(progress)
        timeline.to(progress, { time: STAGED_DROP, duration: left, ease: 'none' }, 0)
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
            const pose = poseOf(body)
            this.tweened.add(pose).add(body)
            timeline.fromTo(
                body,
                { opacity: 0 },
                { opacity: 1, duration: motion.fall * 0.25, ease: 'none', immediateRender: true },
                at
            )
            timeline.fromTo(
                pose,
                { scale: motion.scale, y: motion.rise },
                { scale: 1, y: 0, duration: motion.fall, ease: 'power2.in', immediateRender: true },
                at
            )
            if (motion.bounce !== 0) {
                const landed = at + motion.fall
                timeline.to(
                    pose,
                    { y: motion.bounce, duration: motion.settle, ease: 'power1.out' },
                    landed
                )
                timeline.to(
                    pose,
                    { y: 0, duration: motion.settle, ease: 'power1.in' },
                    landed + motion.settle
                )
            }
        }
        if (shadow !== undefined) {
            touched.push(shadow)
            const pose = poseOf(shadow)
            this.tweened.add(pose).add(shadow)
            timeline.fromTo(
                shadow,
                { opacity: 0 },
                { opacity: 1, duration: motion.fall, ease: 'power2.in', immediateRender: true },
                at
            )
            timeline.fromTo(
                pose,
                { scale: motion.shadow },
                { scale: 1, duration: motion.fall, ease: 'power2.in', immediateRender: true },
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
            const pose = poseOf(body)
            this.tweened.add(pose).add(body)
            timeline.to(body, { opacity: 0, duration, ease: 'power1.out' }, at)
            timeline.to(pose, { y: rise, scale: LIFT.scale, duration, ease: 'power1.out' }, at)
        }
        if (shadow !== undefined) {
            touched.push(shadow)
            const pose = poseOf(shadow)
            this.tweened.add(pose).add(shadow)
            timeline.to(shadow, { opacity: 0, duration, ease: 'power1.out' }, at)
            timeline.to(pose, { scale: 0.7, duration, ease: 'power1.out' }, at)
        }
    }

    // A removed ring's slot, on the board's plane.
    private slotOf(playerId: string, index: number): Point {
        const side = playerId === this.session.topPlayerId ? 'top' : 'bottom'
        return flatRingSlots(side)[index]
    }
}
