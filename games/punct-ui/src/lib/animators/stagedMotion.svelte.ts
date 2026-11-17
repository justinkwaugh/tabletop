import { gsap } from 'gsap'
import { sameCoordinates, type AxialCoordinates, type Point } from '@tabletop/common'
import {
    dotsOf,
    PieceKind,
    spaceKey,
    type HydratedPunctBoard,
    type PlacedPiece
} from '@tabletop/punct'
import { PIECE_HALF_WIDTH, PIECE_THICKNESS, spaceUnder, VIEW } from '$lib/board/geometry.js'
import { HOVER_HEIGHT } from '$lib/board/drawing.js'
import { spineSegments } from '$lib/board/pieceShape.js'
import { FULL_TURN, shortestTurn, wrapRotation } from '$lib/board/rotation.js'
import type { StagedPiece } from '$lib/model/session.svelte.js'
import { PiecePose, progressPath, type PieceAt } from './piecePose.js'

type Timeline = gsap.core.Timeline

// The piece you are placing or moving, hovering where you have put it until you drop it. The
// board draws it after whatever stands on its spaces below it (`cells`, every space it sweeps over
// as it turns), or over everything while it is lifted clear (`aloft`).
export type Hover = {
    piece: PlacedPiece
    pose: PiecePose
    cells: AxialCoordinates[]
    aloft: boolean
}

// A new piece falls, gathering speed, to where it would rest, bounces off it up past the hover,
// and settles back down into the hover.
const DROP = {
    fall: 40,
    duration: 0.26,
    overshoot: PIECE_THICKNESS * 0.45,
    rebound: 0.16,
    settle: 0.18
}
const TURN = { duration: 0.28, perStep: 0.07 }
const RAISE = { duration: 0.18, clearance: PIECE_THICKNESS * 0.25 }
// A moved piece lifts off where it stands, then flies over everything into its hover.
const FLIGHT = { lift: 0.16, travel: 0.42, clearance: PIECE_THICKNESS * 0.5 }
const LANDING = { duration: 0.16, bounce: 6, settle: 0.14 }
const LIFT_OFF = { duration: 0.18, rise: 30 }
const QUICK = 0.18

export class StagedMotion {
    hover: Hover | undefined = $state.raw()
    // A staged choice, not a state change, so this timeline of its own plays the motion.
    private timeline: Timeline | undefined
    // Lifting off or flying back after being let go.
    private leaving = false

    // A new piece drops into its hover, a moved one lifts off and flies there, and a turn swings
    // it round its PÜNCT. Let go by its player, a new piece lifts off and a moved one flies back
    // to where it stood; cleared any other way, it goes at once.
    follow(staged: StagedPiece | undefined, board: HydratedPunctBoard, released: boolean) {
        if (staged === undefined) {
            this.letGo(board, released)
            return
        }
        const piece: PlacedPiece = {
            id: staged.id,
            playerId: staged.playerId,
            kind: staged.kind,
            punct: staged.punct,
            rotation: staged.rotation,
            level: staged.level
        }
        const current = this.hover
        const moved = staged.from !== undefined
        if (current === undefined || !this.samePiece(current.piece, piece) || this.leaving) {
            const origin = moved ? board.pieceById(piece.id) : undefined
            if (origin === undefined) {
                this.drop(piece)
            } else {
                const from = this.leaving && current ? current.pose.current : this.restingAt(origin)
                this.fly(from, piece, board, this.hoverAt(piece))
            }
            return
        }
        if (!sameCoordinates(current.piece.punct, piece.punct)) {
            if (moved) this.fly(current.pose.current, piece, board, this.hoverAt(piece))
            else this.drop(piece)
            return
        }
        if (current.piece.rotation !== piece.rotation || current.piece.level !== piece.level) {
            this.turn(current.pose.current, piece, board)
        }
    }

    // Undoing a drop: the piece rises from where it rests back into its hover.
    rise(piece: PlacedPiece, timeline: Timeline) {
        this.stop()
        const pose = this.show(
            piece,
            this.restingAt(piece),
            dotsOf(piece.kind, piece.punct, piece.rotation),
            false
        )
        timeline.to(
            pose,
            { base: this.hoverAt(piece).base, duration: QUICK, ease: 'power1.out' },
            0
        )
    }

    // Dropping the piece: from wherever it is, even mid-flight or mid-turn, onto where it rests,
    // with a small bounce.
    land(timeline: Timeline) {
        const current = this.hover
        if (current === undefined) throw Error('Only a hovering piece lands')
        this.stop()
        const { pose, piece } = current
        const rest = this.restingAt(piece)
        const angle = pose.angle + shortestTurn(pose.angle, rest.angle)
        timeline.to(
            pose,
            {
                ...rest,
                angle,
                duration: LANDING.duration,
                ease: 'power2.in'
            },
            0
        )
        const half = LANDING.settle / 2
        timeline.to(
            pose,
            { base: rest.base + LANDING.bounce, duration: half, ease: 'power1.out' },
            LANDING.duration
        )
        timeline.to(
            pose,
            { base: rest.base, duration: half, ease: 'power1.in' },
            LANDING.duration + half
        )
    }

    // Puts a hovering piece where it hovers at once, as an interrupted rise ends.
    settle() {
        const current = this.hover
        if (current === undefined) return
        this.stop()
        current.pose.set(this.hoverAt(current.piece))
    }

    clear() {
        this.stop()
        this.hover = undefined
    }

    private letGo(board: HydratedPunctBoard, released: boolean) {
        const current = this.hover
        if (!released || current === undefined) {
            this.clear()
            return
        }
        const origin = board.pieceById(current.piece.id)
        if (origin === undefined) {
            this.liftOff(current.pose)
        } else {
            this.fly(current.pose.current, origin, board, this.restingAt(origin), () =>
                this.clear()
            )
        }
        this.leaving = true
    }

    // A new piece is staged with the board's next id whatever kind you choose, so another kind is
    // another piece, with a pose of its own.
    private samePiece(a: PlacedPiece, b: PlacedPiece): boolean {
        return a.id === b.id && a.kind === b.kind
    }

    private restingAt(piece: PlacedPiece): PieceAt {
        const plan = VIEW.plan(piece.punct)
        const base = VIEW.levelBase(piece.level)
        return { x: plan.x, y: plan.y, base, ground: base, angle: piece.rotation, opacity: 1 }
    }

    private hoverAt(piece: PlacedPiece): PieceAt {
        const rest = this.restingAt(piece)
        return { ...rest, base: rest.base + HOVER_HEIGHT }
    }

    // The hover for a piece, at a pose: the same pose while the same piece hovers.
    private show(
        piece: PlacedPiece,
        at: PieceAt,
        cells: AxialCoordinates[],
        aloft: boolean
    ): PiecePose {
        const current = this.hover
        const pose =
            current !== undefined && this.samePiece(current.piece, piece)
                ? current.pose
                : new PiecePose(piece.kind, piece.id, at)
        pose.set(at)
        this.hover = { piece, pose, cells, aloft }
        return pose
    }

    private stop() {
        this.timeline?.kill()
        this.timeline = undefined
        this.leaving = false
        if (this.hover) gsap.killTweensOf(this.hover.pose)
    }

    private start(): Timeline {
        this.stop()
        this.timeline = gsap.timeline()
        return this.timeline
    }

    private drop(piece: PlacedPiece) {
        const target = this.hoverAt(piece)
        const ground = this.restingAt(piece).base
        const cells = dotsOf(piece.kind, piece.punct, piece.rotation)
        const timeline = this.start()
        const pose = this.show(piece, { ...target, base: target.base + DROP.fall }, cells, false)
        timeline.to(pose, { base: ground, duration: DROP.duration, ease: 'power2.in' }, 0)
        timeline.to(
            pose,
            { base: target.base + DROP.overshoot, duration: DROP.rebound, ease: 'power2.out' },
            DROP.duration
        )
        timeline.to(
            pose,
            { base: target.base, duration: DROP.settle, ease: 'sine.inOut' },
            DROP.duration + DROP.rebound
        )
    }

    private liftOff(pose: PiecePose) {
        const timeline = this.start()
        const ease = 'power1.out'
        timeline.to(pose, { base: pose.base + LIFT_OFF.rise, duration: LIFT_OFF.duration, ease }, 0)
        timeline.to(pose, { opacity: 0, duration: LIFT_OFF.duration, ease: 'power2.in' }, 0)
        timeline.call(() => this.clear(), [], LIFT_OFF.duration)
    }

    // Up off where it is, clear of everything on its way, across while turning, and down into
    // the target: its hover, or where it stood when it is let go.
    private fly(
        from: PieceAt,
        piece: PlacedPiece,
        board: HydratedPunctBoard,
        target: PieceAt,
        done?: () => void
    ) {
        const steps = shortestTurn(from.angle, target.angle)
        const poses = this.between(0, 1, 12).map((t) => ({
            plan: { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t },
            angle: from.angle + steps * t
        }))
        const tallest = this.tallestOn(board, this.cellsUnder(piece.kind, poses), piece.id)
        const cruise = Math.max(
            VIEW.surface(tallest) + FLIGHT.clearance,
            from.base + HOVER_HEIGHT,
            target.base
        )
        const cells = dotsOf(piece.kind, piece.punct, piece.rotation)
        const timeline = this.start()
        const pose = this.show(piece, from, cells, true)
        timeline.to(pose, { base: cruise, duration: FLIGHT.lift, ease: 'power1.out' }, 0)
        // Level across, then easing down into the target over the last stretch.
        const across = progressPath((t) => {
            const descent = Math.max(0, (t - 0.55) / 0.45)
            const settle = descent * descent * (3 - 2 * descent)
            pose.set({
                x: from.x + (target.x - from.x) * t,
                y: from.y + (target.y - from.y) * t,
                base: cruise + (target.base - cruise) * settle,
                ground: from.ground + (target.ground - from.ground) * t,
                angle: from.angle + steps * t
            })
        })
        timeline.to(across, { t: 1, duration: FLIGHT.travel, ease: 'power2.inOut' }, FLIGHT.lift)
        timeline.call(
            () => {
                this.show(piece, target, cells, false)
                done?.()
            },
            [],
            FLIGHT.lift + FLIGHT.travel
        )
    }

    // Round its PÜNCT clockwise, or the other way if that is blocked; if both are, up clear of
    // everything, round, and back down.
    private turn(from: PieceAt, piece: PlacedPiece, board: HydratedPunctBoard) {
        const target = this.hoverAt(piece)
        const clockwise = wrapRotation(target.angle - from.angle)
        const swept = (steps: number) =>
            this.cellsUnder(
                piece.kind,
                this.between(
                    from.angle,
                    from.angle + steps,
                    Math.max(4, Math.ceil(Math.abs(steps) * 8))
                ).map((angle) => ({ plan: { x: target.x, y: target.y }, angle }))
            )
        const clear = (steps: number) =>
            this.tallestOn(board, swept(steps), piece.id) <= piece.level + 1
        const ways = [clockwise, clockwise - FULL_TURN].filter((steps) => steps !== 0)
        const free = ways.find(clear)
        const steps = free ?? ways[0] ?? 0
        const lifts = free === undefined && steps !== 0
        const cells = dotsOf(piece.kind, piece.punct, piece.rotation)
        const timeline = this.start()
        const pose = this.show(piece, from, [...cells, ...swept(steps)], lifts)
        let at = 0
        if (lifts) {
            const tallest = this.tallestOn(board, swept(steps), piece.id)
            const above = Math.max(target.base, VIEW.surface(tallest) + RAISE.clearance)
            timeline.to(pose, { base: above, duration: RAISE.duration, ease: 'power1.out' }, at)
            at += RAISE.duration
        }
        const duration = TURN.duration + TURN.perStep * Math.abs(steps)
        timeline.to(pose, { angle: from.angle + steps, duration, ease: 'power2.inOut' }, at)
        at += duration
        if (from.base !== target.base || free === undefined) {
            timeline.to(
                pose,
                {
                    base: target.base,
                    ground: target.ground,
                    duration: RAISE.duration,
                    ease: 'power1.in'
                },
                at
            )
            at += RAISE.duration
        }
        timeline.call(() => this.show(piece, target, cells, false), [], at)
    }

    // The spaces under where the piece passes through these poses.
    private cellsUnder(
        kind: PieceKind,
        poses: { plan: Point; angle: number }[]
    ): AxialCoordinates[] {
        const cells = new Map<number, AxialCoordinates>()
        for (const pose of poses) {
            for (const [a, b] of spineSegments(kind, pose.angle)) {
                const length = Math.hypot(b.x - a.x, b.y - a.y)
                const across = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
                for (let step = 0; step <= 4; step++) {
                    const along = step / 4
                    for (const side of [-0.7, 0, 0.7]) {
                        const offset = side * PIECE_HALF_WIDTH
                        const cell = spaceUnder({
                            x: pose.plan.x + a.x + (b.x - a.x) * along + across.x * offset,
                            y: pose.plan.y + a.y + (b.y - a.y) * along + across.y * offset
                        })
                        cells.set(spaceKey(cell), cell)
                    }
                }
            }
        }
        return [...cells.values()]
    }

    // The tallest stack, in levels, among these spaces, leaving out the piece being moved.
    private tallestOn(
        board: HydratedPunctBoard,
        cells: AxialCoordinates[],
        movingId: number
    ): number {
        return Math.max(0, ...cells.map((cell) => board.heightAt(cell, movingId)))
    }

    private between(from: number, to: number, count: number): number[] {
        return Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count)
    }
}
