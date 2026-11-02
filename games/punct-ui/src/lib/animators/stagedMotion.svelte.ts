import { gsap } from 'gsap'
import { type AxialCoordinates, type Point } from '@tabletop/common'
import {
    dotsOf,
    PieceKind,
    spaceKey,
    type HydratedPunctBoard,
    type PlacedPiece
} from '@tabletop/punct'
import { PIECE_HALF_WIDTH, PIECE_THICKNESS, spaceUnder, VIEW } from '$lib/board/geometry.js'
import { spineSegments } from '$lib/board/pieceShape.js'
import type { StagedPiece } from '$lib/model/session.svelte.js'

// The piece you are placing or moving, hovering where you have put it before you drop it: a
// little more than a piece's thickness above where it will rest. Positions are on the unturned
// board's plane; heights are of the piece's underside.
export type Hover = {
    piece: PlacedPiece
    plan: Point
    base: number
    // The height of the surface its shadow falls on.
    ground: number
    angle: number
    // Lifted clear above everything, drawn over the other pieces.
    aloft: boolean
    // The spaces it stands over, or sweeps over as it turns: it is drawn after whatever stands
    // on them below it.
    cells: AxialCoordinates[]
}

const FLOAT = PIECE_THICKNESS * 1.15
// A new piece falls, gathering speed, to where it would rest, bounces off it up past the hover,
// and settles back down into the hover.
const DROP = {
    fall: 40,
    duration: 0.26,
    overshoot: PIECE_THICKNESS * 0.45,
    rebound: 0.16,
    settle: 0.18
}
// A turn about the PÜNCT eases in and out; a lift clears whatever stands in the way.
const TURN = { duration: 0.28, perStep: 0.07 }
const RAISE = { duration: 0.18, clearance: PIECE_THICKNESS * 0.25 }
// A moved piece lifts off where it stands, then flies over everything into its hover.
const FLIGHT = { lift: 0.16, travel: 0.42, clearance: PIECE_THICKNESS * 0.5 }
// The drop from the hover onto the board.
const LANDING = { duration: 0.16, bounce: 6, settle: 0.14 }
const QUICK = 0.18

function restingBase(level: number): number {
    return VIEW.levelBase(level)
}

function hoverBase(level: number): number {
    return restingBase(level) + FLOAT
}

function wrapped(steps: number, period: number): number {
    return ((steps % period) + period) % period
}

type Pose = { plan: Point; angle: number }

// The spaces under where the piece passes through these poses.
function cellsUnder(kind: PieceKind, poses: Pose[]): AxialCoordinates[] {
    const cells = new Map<number, AxialCoordinates>()
    for (const pose of poses) {
        for (const [a, b] of spineSegments(kind, pose.angle)) {
            const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
            const across = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
            for (let step = 0; step <= 4; step++) {
                const along = step / 4
                for (const side of [-0.7, 0, 0.7]) {
                    const cell = spaceUnder({
                        x:
                            pose.plan.x +
                            a.x +
                            (b.x - a.x) * along +
                            across.x * side * PIECE_HALF_WIDTH,
                        y:
                            pose.plan.y +
                            a.y +
                            (b.y - a.y) * along +
                            across.y * side * PIECE_HALF_WIDTH
                    })
                    cells.set(spaceKey(cell), cell)
                }
            }
        }
    }
    return [...cells.values()]
}

// The tallest stack, in levels, among these spaces, leaving out the piece being moved.
function tallestOn(
    board: HydratedPunctBoard,
    cells: AxialCoordinates[],
    movingId: number | undefined
): number {
    return Math.max(0, ...cells.map((cell) => board.heightAt(cell, movingId)))
}

function between(from: number, to: number, count: number): number[] {
    return Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count)
}

export class StagedMotion {
    hover: Hover | undefined = $state()
    private timeline: gsap.core.Timeline | undefined

    // Follows the piece the session stages: a new piece drops into its hover, a moved one lifts
    // off and flies there, and a turn swings it round its PÜNCT.
    follow(staged: StagedPiece | undefined, board: HydratedPunctBoard) {
        if (staged === undefined) {
            this.stop()
            this.hover = undefined
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
        if (current === undefined || current.piece.id !== piece.id) {
            const origin = moved ? board.pieceById(piece.id) : undefined
            if (origin) {
                this.fly(this.restingOn(origin), piece, board)
            } else {
                this.drop(piece)
            }
            return
        }
        const samePlace =
            current.piece.punct.q === piece.punct.q && current.piece.punct.r === piece.punct.r
        if (!samePlace) {
            if (moved) this.fly(current, piece, board)
            else this.drop(piece)
            return
        }
        if (current.piece.rotation !== piece.rotation || current.piece.level !== piece.level) {
            this.turn(current, piece, board)
        }
    }

    // Undoing a drop: the piece rises from where it rested back into its hover, where the
    // session stages it again.
    rise(piece: PlacedPiece, timeline: gsap.core.Timeline) {
        this.stop()
        const start = this.restingOn(piece)
        const proxy = { base: start.base }
        this.hover = start
        timeline.to(
            proxy,
            {
                base: hoverBase(piece.level),
                duration: QUICK,
                ease: 'power1.out',
                onUpdate: () => this.set({ base: proxy.base })
            },
            0
        )
    }

    // Dropping the piece: from its hover onto where it rests, with a small bounce.
    land(timeline: gsap.core.Timeline) {
        const hover = this.hover
        if (hover === undefined) return
        this.stop()
        const rest = restingBase(hover.piece.level)
        const proxy = { base: hover.base }
        const update = () => this.set({ base: proxy.base })
        timeline.to(
            proxy,
            { base: rest, duration: LANDING.duration, ease: 'power2.in', onUpdate: update },
            0
        )
        timeline.to(proxy, {
            base: rest + LANDING.bounce,
            duration: LANDING.settle / 2,
            ease: 'power1.out',
            onUpdate: update
        })
        timeline.to(proxy, {
            base: rest,
            duration: LANDING.settle / 2,
            ease: 'power1.in',
            onUpdate: update
        })
    }

    clear() {
        this.stop()
        this.hover = undefined
    }

    private restingOn(piece: PlacedPiece): Hover {
        return {
            piece,
            plan: VIEW.plan(piece.punct),
            base: restingBase(piece.level),
            ground: restingBase(piece.level),
            angle: piece.rotation,
            aloft: false,
            cells: dotsOf(piece.kind, piece.punct, piece.rotation)
        }
    }

    private hoverOf(piece: PlacedPiece): Hover {
        return { ...this.restingOn(piece), base: hoverBase(piece.level) }
    }

    private set(change: Partial<Hover>) {
        if (this.hover) this.hover = { ...this.hover, ...change }
    }

    private stop() {
        this.timeline?.kill()
        this.timeline = undefined
    }

    private start(): gsap.core.Timeline {
        this.stop()
        this.timeline = gsap.timeline()
        return this.timeline
    }

    private drop(piece: PlacedPiece) {
        const target = this.hoverOf(piece)
        const ground = restingBase(piece.level)
        const proxy = { base: target.base + DROP.fall }
        this.hover = { ...target, base: proxy.base }
        const update = () => this.set({ base: proxy.base })
        const timeline = this.start()
        timeline.to(proxy, {
            base: ground,
            duration: DROP.duration,
            ease: 'power2.in',
            onUpdate: update
        })
        timeline.to(proxy, {
            base: target.base + DROP.overshoot,
            duration: DROP.rebound,
            ease: 'power2.out',
            onUpdate: update
        })
        timeline.to(proxy, {
            base: target.base,
            duration: DROP.settle,
            ease: 'sine.inOut',
            onUpdate: update
        })
    }

    // Up off where it is, clear of everything on its way, across while turning, and down into
    // its hover.
    private fly(from: Hover, piece: PlacedPiece, board: HydratedPunctBoard) {
        const target = this.hoverOf(piece)
        const turnSteps = wrapped(target.angle - from.angle, 6)
        const steps = turnSteps > 3 ? turnSteps - 6 : turnSteps
        const poses = between(0, 1, 12).map((t) => ({
            plan: {
                x: from.plan.x + (target.plan.x - from.plan.x) * t,
                y: from.plan.y + (target.plan.y - from.plan.y) * t
            },
            angle: from.angle + steps * t
        }))
        const tallest = tallestOn(board, cellsUnder(piece.kind, poses), piece.id)
        const cruise = Math.max(
            VIEW.surface(tallest) + FLIGHT.clearance,
            from.base + FLOAT,
            target.base
        )
        const proxy = { t: 0, base: from.base }
        this.hover = { ...from, piece, aloft: true }
        const timeline = this.start()
        timeline.to(proxy, {
            base: cruise,
            duration: FLIGHT.lift,
            ease: 'power1.out',
            onUpdate: () => this.set({ base: proxy.base })
        })
        timeline.to(proxy, {
            t: 1,
            duration: FLIGHT.travel,
            ease: 'power2.inOut',
            onUpdate: () => {
                const t = proxy.t
                // Level across, then easing down into the hover over the last stretch.
                const descent = Math.max(0, (t - 0.55) / 0.45)
                const settle = descent * descent * (3 - 2 * descent)
                this.set({
                    plan: {
                        x: from.plan.x + (target.plan.x - from.plan.x) * t,
                        y: from.plan.y + (target.plan.y - from.plan.y) * t
                    },
                    base: cruise + (target.base - cruise) * settle,
                    ground: from.ground + (target.ground - from.ground) * t,
                    angle: from.angle + steps * t
                })
            },
            onComplete: () => this.set({ ...target })
        })
    }

    // Round its PÜNCT the way it was asked (clockwise), or the other way if that is blocked; if
    // both are, up clear of everything, round, and back down.
    private turn(from: Hover, piece: PlacedPiece, board: HydratedPunctBoard) {
        const target = this.hoverOf(piece)
        const clockwise = wrapped(target.angle - from.angle, 6)
        const sweep = (steps: number) =>
            between(
                from.angle,
                from.angle + steps,
                Math.max(4, Math.ceil(Math.abs(steps) * 8))
            ).map((angle) => ({ plan: target.plan, angle }))
        const swept = (steps: number) => cellsUnder(piece.kind, sweep(steps))
        const clear = (steps: number) => tallestOn(board, swept(steps), piece.id) <= piece.level + 1
        const ways = [clockwise, clockwise - 6].filter((steps) => steps !== 0)
        const free = ways.find(clear)
        const steps = free ?? ways[0] ?? 0
        const proxy = { angle: from.angle, base: from.base }
        const timeline = this.start()
        const duration = TURN.duration + TURN.perStep * Math.abs(steps)
        const update = () => this.set({ angle: proxy.angle, base: proxy.base })
        this.hover = { ...from, piece, cells: [...target.cells, ...swept(steps)] }
        if (free === undefined && steps !== 0) {
            const tallest = tallestOn(board, swept(steps), piece.id)
            const above = Math.max(target.base, VIEW.surface(tallest) + RAISE.clearance)
            this.set({ aloft: true })
            timeline.to(proxy, {
                base: above,
                duration: RAISE.duration,
                ease: 'power1.out',
                onUpdate: update
            })
        }
        timeline.to(proxy, {
            angle: from.angle + steps,
            duration,
            ease: 'power2.inOut',
            onUpdate: update
        })
        if (proxy.base !== target.base || free === undefined) {
            timeline.to(proxy, {
                base: target.base,
                duration: RAISE.duration,
                ease: 'power1.in',
                onUpdate: update
            })
        }
        timeline.call(() => this.set({ ...target }))
    }
}
