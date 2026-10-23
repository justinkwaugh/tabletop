import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { distanceAxial, sameCoordinates, type AxialCoordinates, type Point } from '@tabletop/common'
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
    type HydratedYinshGameState
} from '@tabletop/yinsh'
import type { YinshGameSession } from '$lib/model/session.svelte.js'
import { boardDiff, type BoardDiff } from '$lib/board/boardDiff.js'
import { coordsKey, pointCenter, ringSlots } from '$lib/board/geometry.js'
import { DROP } from '$lib/board/dropIn.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const PLACE = { duration: 0.3, scale: 1.25, rise: -14 }
const MOVE = { start: 0.1, duration: 0.42 }
const FLIP = { duration: 0.26, rise: -10, scale: 1.12 }
const LIFT = { duration: 0.3, rise: -14, scale: 1.1, stagger: 0.03 }
const TAKE = 0.42
const MARK_FADE = 0.2
const FALLBACK = 0.18

export type DrawnPiece = {
    key: string
    kind: 'ring' | 'marker'
    coords: AxialCoordinates
    playerId: string
    // A marker turning over shows this player's face once it has flipped. It turns along the
    // ring's path, at `angle` degrees on screen.
    flip?: { toPlayerId: string; angle: number }
}

// The ring in flight, drawn above the board at the point it leaves.
export type Flier = { at: AxialCoordinates; playerId: string }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedYinshGameState, AnimationContext>

export function pieceKey(kind: DrawnPiece['kind'], coords: AxialCoordinates): string {
    return `${kind}-${coordsKey(coords)}`
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
                      playerId: point.markerPlayerId
                  }
              ]),
        ...(point.ringPlayerId === undefined
            ? []
            : [
                  {
                      key: pieceKey('ring', point.coords),
                      kind: 'ring' as const,
                      coords: point.coords,
                      playerId: point.ringPlayerId
                  }
              ])
    ])
}

function removedCounts(state: HydratedYinshGameState): Record<string, number> {
    return Object.fromEntries(state.players.map((p) => [p.playerId, p.ringsRemoved]))
}

export class BoardAnimator {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    pieces: DrawnPiece[] = $derived.by(() => drawnPieces(this.session.gameState))
    ringsRemoved: Record<string, number> = $derived.by(() => removedCounts(this.session.gameState))
    flier: Flier | undefined = $state()

    private readonly nodes = new Map<string, SVGGElement>()
    private flierElement: SVGGElement | undefined
    private markLayer: SVGGElement | undefined
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

    // One face of a turning marker. Its frame is turned to the ring's path, so squashing it
    // across x turns the marker over along that path; the other face waits edge-on.
    flipFace(key: string, angle: number, waiting: boolean): Attachment<SVGGElement> {
        return (element) => {
            gsap.set(element, { svgOrigin: '0 0', rotation: angle, scaleX: waiting ? 0 : 1 })
            this.nodes.set(key, element)
            return () => {
                if (this.nodes.get(key) === element) this.nodes.delete(key)
            }
        }
    }

    flierNode(): Attachment<SVGGElement> {
        return (element) => {
            gsap.set(element, { svgOrigin: '0 0' })
            this.flierElement = element
            return () => {
                if (this.flierElement === element) this.flierElement = undefined
            }
        }
    }

    marks(): Attachment<SVGGElement> {
        return (element) => {
            this.markLayer = element
            return () => {
                if (this.markLayer === element) this.markLayer = undefined
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
        const touched: SVGGElement[] = []
        const diff = boardDiff(from.board, to.board)
        const fast = action === undefined

        this.pieces = this.inBetween(from, diff)
        this.flier = diff.movedRing && {
            at: diff.movedRing.from,
            playerId: diff.movedRing.playerId
        }
        if (isRemoveRing(action)) {
            this.flier = { at: action.coords, playerId: action.playerId }
            this.pieces = this.pieces.filter(
                (piece) => piece.key !== pieceKey('ring', action.coords)
            )
        }
        await tick()

        if (isPlaceRing(action)) {
            this.enter(pieceKey('ring', action.coords), timeline, touched, PLACE)
        } else if (isMoveRing(action)) {
            // The mover's own marker already dropped into the ring as a staged preview.
            if (kind !== 'own-action') {
                this.enter(pieceKey('marker', action.from), timeline, touched, DROP)
            }
            this.flyRing(action.from, pointCenter(action.to), timeline, MOVE.start, MOVE.duration)
            const length = distanceAxial(action.from, action.to)
            for (const marker of diff.flipped) {
                const passed = distanceAxial(action.from, marker.coords) / length
                const at = MOVE.start + MOVE.duration * passed - FLIP.duration / 2
                this.flip(marker.coords, timeline, Math.max(at, 0), FLIP.duration, touched)
            }
        } else if (isRemoveRow(action)) {
            action.metadata?.markers.forEach((coords, index) => {
                for (const node of this.targets(pieceKey('marker', coords))) {
                    touched.push(node)
                    timeline.to(
                        node,
                        {
                            opacity: 0,
                            y: LIFT.rise,
                            scale: LIFT.scale,
                            duration: LIFT.duration,
                            ease: 'power1.out'
                        },
                        index * LIFT.stagger
                    )
                }
            })
        } else if (isRemoveRing(action)) {
            const slot = this.slotOf(
                action.playerId,
                to.getPlayerState(action.playerId).ringsRemoved - 1
            )
            this.flyRing(action.coords, slot, timeline, 0, TAKE)
        } else {
            this.fallback(diff, timeline, touched, fast)
        }
        if (this.markLayer) {
            timeline.to(this.markLayer, { opacity: 0, duration: fast ? FALLBACK : MARK_FADE }, 0)
        }

        animationContext.afterAnimations(() => {
            this.pieces = drawnPieces(to)
            this.ringsRemoved = removedCounts(to)
            this.flier = undefined
            for (const node of touched) {
                gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            }
            if (this.markLayer) gsap.set(this.markLayer, { opacity: 1 })
        })
    }

    // The board partway: the `from` pieces without the ring in flight, with markers about to
    // turn showing both faces, and with every arriving piece drawn so it can fade in.
    private inBetween(from: HydratedYinshGameState, diff: BoardDiff): DrawnPiece[] {
        const moving = diff.movedRing
        const angle = moving ? travelAngle(moving.from, moving.to) : 90
        const kept = drawnPieces(from).flatMap((piece): DrawnPiece[] => {
            if (moving && piece.kind === 'ring' && sameCoordinates(piece.coords, moving.from)) {
                return []
            }
            const flip = diff.flipped.find((marker) => sameCoordinates(marker.coords, piece.coords))
            return [
                flip && piece.kind === 'marker'
                    ? { ...piece, flip: { toPlayerId: flip.toPlayerId, angle } }
                    : piece
            ]
        })
        const arriving = [
            ...diff.markersCome.map((marker) => ({ ...marker, kind: 'marker' as const })),
            ...diff.ringsCome.map((ring) => ({ ...ring, kind: 'ring' as const }))
        ].map((piece) => ({ ...piece, key: pieceKey(piece.kind, piece.coords) }))
        return [...kept, ...arriving]
    }

    // Undo and history steps carry no action: everything moves at once, quickly.
    private fallback(diff: BoardDiff, timeline: Timeline, touched: SVGGElement[], fast: boolean) {
        const duration = fast ? FALLBACK : MOVE.duration
        if (diff.movedRing) {
            this.flyRing(diff.movedRing.from, pointCenter(diff.movedRing.to), timeline, 0, duration)
        }
        for (const marker of diff.flipped) {
            this.flip(marker.coords, timeline, 0, duration, touched)
        }
        for (const piece of [
            ...diff.markersCome.map((m) => pieceKey('marker', m.coords)),
            ...diff.ringsCome.map((r) => pieceKey('ring', r.coords))
        ]) {
            this.enter(piece, timeline, touched, { duration: duration * 0.8, scale: 1, rise: 0 })
        }
        const gone = [
            ...diff.markersGone.map((m) => pieceKey('marker', m.coords)),
            ...diff.ringsGone.map((r) => pieceKey('ring', r.coords))
        ]
        for (const key of gone) {
            for (const node of this.targets(key)) {
                touched.push(node)
                timeline.to(node, { opacity: 0, duration: duration * 0.8 }, 0)
            }
        }
    }

    private targets(key: string): SVGGElement[] {
        return [this.nodes.get(key), this.nodes.get(`${key}:shadow`)].filter(
            (node) => node !== undefined
        )
    }

    private enter(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        motion: { duration: number; scale: number; rise: number }
    ) {
        for (const node of this.targets(key)) {
            touched.push(node)
            timeline.fromTo(
                node,
                { opacity: 0, scale: motion.scale, y: motion.rise },
                { opacity: 1, scale: 1, y: 0, duration: motion.duration, ease: 'power2.out' },
                0
            )
        }
    }

    private flip(
        coords: AxialCoordinates,
        timeline: Timeline,
        at: number,
        duration: number,
        touched: SVGGElement[]
    ) {
        const key = pieceKey('marker', coords)
        const front = this.nodes.get(`${key}:front`)
        const back = this.nodes.get(`${key}:back`)
        const disc = this.nodes.get(key)
        if (front === undefined || back === undefined || disc === undefined) return
        touched.push(front, back, disc)
        const half = duration / 2
        // The marker lifts off the board to turn over and settles back.
        timeline.to(
            disc,
            { y: FLIP.rise, scale: FLIP.scale, duration: half, ease: 'power1.out' },
            at
        )
        timeline.to(disc, { y: 0, scale: 1, duration: half, ease: 'power1.in' }, at + half)
        timeline.to(front, { scaleX: 0, duration: half, ease: 'power1.in' }, at)
        timeline.fromTo(
            back,
            { scaleX: 0 },
            { scaleX: 1, duration: half, ease: 'power1.out', immediateRender: false },
            at + half
        )
    }

    private flyRing(
        from: AxialCoordinates,
        to: Point,
        timeline: Timeline,
        at: number,
        duration: number
    ) {
        const node = this.flierElement
        if (node === undefined) return
        const start = pointCenter(from)
        gsap.set(node, { x: 0, y: 0, scale: 1 })
        timeline.to(
            node,
            { x: to.x - start.x, y: to.y - start.y, duration, ease: 'power2.inOut' },
            at
        )
        timeline.to(
            node,
            { scale: 1.06, duration: duration / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' },
            at
        )
    }

    private slotOf(playerId: string, index: number): Point {
        const side = playerId === this.session.topPlayerId ? 'top' : 'bottom'
        return ringSlots(side)[index]
    }
}

function travelAngle(from: AxialCoordinates, to: AxialCoordinates): number {
    const start = pointCenter(from)
    const end = pointCenter(to)
    return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
}
