import type { Point, RandomFunction } from '@tabletop/common'
import { CLIP_X, CLIP_Y, type Side } from './flock.js'

export type VultureMode = 'soaring' | 'departing' | 'gone'

export type KettleParams = {
    center: Point
    entrySide: Side
    exitSide: Side
    size: number
    boardWidth: number
    boardHeight: number
}

const SOAR_SPEED = 26
const DEPART_SPEED = 33
const STARTLE_BOOST = 1.6
const MAX_TURN_RATE = 1.2
const ANCHOR_SPREAD = 25
const MIN_ORBIT = 24
const MAX_ORBIT = 40
const RADIUS_PULL = 1.2
const ENTRY_SPACING = 22
const ENTRY_HEIGHT_SPREAD = 70

// The farthest a soaring vulture strays from the kettle's center: its widest orbit around the
// farthest anchor, plus a full turn's overshoot when it is drawn to a new anchor.
export const KETTLE_REACH = ANCHOR_SPREAD + MAX_ORBIT + (2 * SOAR_SPEED) / MAX_TURN_RATE

function between(random: RandomFunction, low: number, high: number): number {
    return low + random() * (high - low)
}

function wrapAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export class Vulture {
    pos: Point
    heading: number
    mode: VultureMode = 'soaring'
    private anchor: Point
    private orbit: number
    private turnDirection: 1 | -1
    private anchorLeft: number
    private exit: Point = { x: 0, y: 0 }
    private speed = SOAR_SPEED

    constructor(
        readonly id: number,
        start: Point,
        private readonly kettle: Kettle,
        private readonly random: RandomFunction
    ) {
        this.pos = { ...start }
        this.anchor = kettle.pickAnchor()
        this.orbit = between(random, MIN_ORBIT, MAX_ORBIT)
        this.turnDirection = random() < 0.5 ? 1 : -1
        this.anchorLeft = between(random, 3, 6)
        this.heading = Math.atan2(this.anchor.y - start.y, this.anchor.x - start.x)
    }

    step(dt: number) {
        switch (this.mode) {
            case 'soaring':
                this.anchorLeft -= dt
                if (this.anchorLeft <= 0) this.driftToNewAnchor()
                this.steer(this.orbitHeading(), dt)
                break
            case 'departing':
                this.steer(Math.atan2(this.exit.y - this.pos.y, this.exit.x - this.pos.x), dt)
                if (this.kettle.isBeyondClip(this.pos)) this.mode = 'gone'
                break
            case 'gone':
                break
        }
    }

    depart(startled: boolean) {
        if (this.mode !== 'soaring') return
        this.mode = 'departing'
        this.exit = this.kettle.exitPointFor(this)
        this.speed = DEPART_SPEED * (startled ? STARTLE_BOOST : 1)
    }

    // Fly across the line to the anchor, bending toward it when farther out than this vulture's
    // orbit and away when closer in, so the path loops around the anchor without ever locking
    // onto a circle.
    private orbitHeading(): number {
        const toAnchor = Math.atan2(this.anchor.y - this.pos.y, this.anchor.x - this.pos.x)
        const distance = Math.hypot(this.anchor.x - this.pos.x, this.anchor.y - this.pos.y)
        const pull = Math.max(-1, Math.min(1, ((distance - this.orbit) / this.orbit) * RADIUS_PULL))
        return toAnchor - this.turnDirection * (Math.PI / 2) * (1 - pull)
    }

    private steer(desired: number, dt: number) {
        const maxTurn = MAX_TURN_RATE * (this.speed / SOAR_SPEED) * dt
        const turn = Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(desired - this.heading)))
        this.heading = wrapAngle(this.heading + turn)
        this.pos = {
            x: this.pos.x + Math.cos(this.heading) * this.speed * dt,
            y: this.pos.y + Math.sin(this.heading) * this.speed * dt
        }
    }

    private driftToNewAnchor() {
        this.anchor = this.kettle.pickAnchor()
        this.orbit = between(this.random, MIN_ORBIT, MAX_ORBIT)
        this.anchorLeft = between(this.random, 3, 6)
        if (this.random() < 0.25) this.turnDirection = this.turnDirection === 1 ? -1 : 1
    }
}

// Vultures that glide in, wheel loosely over one desert square without landing, and soar away.
export class Kettle {
    readonly vultures: Vulture[]
    readonly center: Point
    leaving = false
    private arrived = false
    private stayLeft: number
    private readonly departures: number[]

    constructor(
        private readonly params: KettleParams,
        private readonly random: RandomFunction
    ) {
        this.center = { ...params.center }
        this.stayLeft = between(random, 18, 28)
        this.vultures = Array.from({ length: params.size }, (_, index) => {
            const edgeX = params.entrySide === 'left' ? -CLIP_X : params.boardWidth + CLIP_X
            const trail = ENTRY_SPACING * index * (params.entrySide === 'left' ? -1 : 1)
            const height = params.center.y + between(random, -ENTRY_HEIGHT_SPREAD, ENTRY_HEIGHT_SPREAD)
            const start = { x: edgeX + trail, y: Math.max(20, Math.min(params.boardHeight - 20, height)) }
            return new Vulture(index, start, this, random)
        })
        this.departures = this.vultures.map(() => between(random, 0, 2.5))
    }

    get isGone(): boolean {
        return this.vultures.every((vulture) => vulture.mode === 'gone')
    }

    isOverSquare(point: Point): boolean {
        return Math.hypot(point.x - this.center.x, point.y - this.center.y) <= KETTLE_REACH
    }

    pickAnchor(): Point {
        const angle = between(this.random, 0, Math.PI * 2)
        const distance = between(this.random, 0, ANCHOR_SPREAD)
        return {
            x: this.center.x + Math.cos(angle) * distance,
            y: this.center.y + Math.sin(angle) * distance
        }
    }

    step(dt: number) {
        // The stay counts from the first vulture reaching the square, since gliding in is slow.
        this.arrived ||= this.vultures.some((vulture) => this.isOverSquare(vulture.pos))
        if (this.arrived && !this.leaving) {
            this.stayLeft -= dt
            if (this.stayLeft <= 0) this.leaving = true
        }
        if (this.leaving) {
            this.vultures.forEach((vulture, index) => {
                this.departures[index] -= dt
                if (this.departures[index] <= 0) vulture.depart(false)
            })
        }
        for (const vulture of this.vultures) vulture.step(dt)
    }

    startle() {
        this.leaving = true
        for (const vulture of this.vultures) vulture.depart(true)
    }

    exitPointFor(vulture: Vulture): Point {
        const { exitSide, boardWidth } = this.params
        return {
            x: exitSide === 'left' ? -CLIP_X - 40 : boardWidth + CLIP_X + 40,
            y: Math.max(-CLIP_Y - 20, this.center.y - between(this.random, 80, 160) + vulture.id * 6)
        }
    }

    isBeyondClip(point: Point): boolean {
        return point.x < -CLIP_X || point.x > this.params.boardWidth + CLIP_X || point.y < -CLIP_Y
    }
}
