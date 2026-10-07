import { assert, type BoundingBox, type Point, type RandomFunction } from '@tabletop/common'

export type Side = 'left' | 'right'
export type BirdMode = 'arriving' | 'landed' | 'relocating' | 'departing' | 'gone'
export type BirdPose = 'fly-a' | 'fly-b' | 'ground'
export type GroundBehavior = 'idle' | 'peck'

export type FlockParams = {
    cells: BoundingBox[]
    nearbyCells: BoundingBox[]
    entrySide: Side
    exitSide: Side
    size: number
    boardWidth: number
    boardHeight: number
}

export const CLIP_X = 30
export const CLIP_Y = 14
const ZONE_INSET = 10
const TRAIL_SPACING = 14
const LANDING_SPACING = 10
const ARRIVAL_RADIUS = 60
const GLIDE_RADIUS = 40
const LANDED_RADIUS = 2
const FLIGHT_SEPARATION = 14
const GROUND_SEPARATION = 9
const SEPARATION_PUSH = 20
const STEER_RATE = 4
const MEANDER_ARRIVING = 0.6
const MEANDER_DEPARTING = 0.3
const MEANDER_SETTLE_RADIUS = 120
const FLAP_RATE = 8
const PECK_TILT = 20
const STARTLE_BOOST = 1.3

const GROUND_BEHAVIORS: ReadonlyArray<{ kind: GroundBehavior; weight: number }> = [
    { kind: 'idle', weight: 0.55 },
    { kind: 'peck', weight: 0.45 }
]

function between(random: RandomFunction, low: number, high: number): number {
    return low + random() * (high - low)
}

function clamp(value: number, low: number, high: number): number {
    return Math.max(low, Math.min(high, value))
}

function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y)
}

export class Bird {
    pos: Point
    vel: Point = { x: 0, y: 0 }
    heading: number
    facing: 1 | -1 = 1
    flapPhase: number
    meanderPhase: number
    private readonly meanderRate: number
    mode: BirdMode = 'arriving'
    spot: Point
    target: Point
    speed: number
    patience: number
    restlessness: number
    reactionDelay = Infinity
    readonly behaviors = GROUND_BEHAVIORS
    behavior: GroundBehavior = 'idle'
    behaviorDuration = 0
    behaviorTimer = 0
    peckTilt = 0

    constructor(
        readonly id: number,
        start: Point,
        spot: Point,
        public zoneIndex: number,
        private readonly random: RandomFunction
    ) {
        this.pos = { ...start }
        this.spot = { ...spot }
        this.target = { ...spot }
        this.heading = spot.x >= start.x ? 0 : Math.PI
        this.flapPhase = random() * 10
        this.meanderPhase = random() * Math.PI * 2
        this.meanderRate = between(random, 0.8, 1.6)
        this.speed = between(random, 70, 90)
        this.patience = between(random, 7, 14)
        this.restlessness = this.nextRestlessness()
    }

    get pose(): BirdPose {
        if (this.mode === 'landed') return 'ground'
        const approaching = this.mode === 'arriving' || this.mode === 'relocating'
        const gliding = approaching && distance(this.pos, this.target) < GLIDE_RADIUS
        return gliding || Math.floor(this.flapPhase) % 2 === 0 ? 'fly-a' : 'fly-b'
    }

    step(dt: number, flock: Flock) {
        switch (this.mode) {
            case 'arriving':
            case 'relocating':
                this.fly(dt, true)
                if (flock.leaving) this.reactionDelay -= dt
                if (this.reactionDelay <= 0) this.depart(flock)
                else if (distance(this.pos, this.target) < LANDED_RADIUS) this.land()
                break
            case 'landed':
                this.scavenge(dt)
                this.patience -= dt
                this.restlessness -= dt
                if (flock.leaving) this.reactionDelay -= dt
                if (this.reactionDelay <= 0) this.depart(flock)
                else if (this.patience <= 0) {
                    flock.beginLeaving()
                    this.depart(flock)
                } else if (this.restlessness <= 0 && !flock.leaving) {
                    flock.relocate(this)
                }
                break
            case 'departing':
                this.fly(dt, false)
                if (flock.isBeyondClip(this.pos)) this.mode = 'gone'
                break
            case 'gone':
                break
        }
    }

    depart(flock: Flock) {
        this.mode = 'departing'
        this.target = flock.exitPointFor(this)
        this.speed = between(this.random, 90, 115) * (flock.startled ? STARTLE_BOOST : 1)
        this.peckTilt = 0
    }

    flyTo(spot: Point, zoneIndex: number) {
        this.spot = { ...spot }
        this.target = { ...spot }
        this.zoneIndex = zoneIndex
        this.mode = 'relocating'
        this.speed = between(this.random, 70, 90)
        this.peckTilt = 0
        this.vel = { x: 0, y: -20 }
    }

    // Grounded overlap is resolved outright, split between the two birds; in flight a rate-based
    // nudge avoids jitter.
    separateFrom(other: Bird, dt: number) {
        const grounded = this.mode === 'landed'
        const spacing = grounded ? GROUND_SEPARATION : FLIGHT_SEPARATION
        const gap = distance(this.pos, other.pos)
        if (gap >= spacing || gap === 0) return
        const push = grounded
            ? (spacing - gap) / 2
            : ((spacing - gap) / spacing) * SEPARATION_PUSH * dt
        this.pos = {
            x: this.pos.x + ((this.pos.x - other.pos.x) / gap) * push,
            y: this.pos.y + ((this.pos.y - other.pos.y) / gap) * push
        }
    }

    private fly(dt: number, slowOnArrival: boolean) {
        const dx = this.target.x - this.pos.x
        const dy = this.target.y - this.pos.y
        const dist = Math.hypot(dx, dy)
        const arrivalFactor = slowOnArrival ? clamp((dist / ARRIVAL_RADIUS) ** 1.5, 0.08, 1) : 1
        const meander = this.meanderAmplitude(slowOnArrival, dist) * Math.sin(this.meanderPhase)
        const desired =
            dist === 0
                ? { x: 0, y: 0 }
                : {
                      x: (dx / dist) * this.speed * arrivalFactor + (-dy / dist) * meander,
                      y: (dy / dist) * this.speed * arrivalFactor + (dx / dist) * meander
                  }
        const blend = Math.min(1, dt * STEER_RATE)
        this.vel = {
            x: this.vel.x + (desired.x - this.vel.x) * blend,
            y: this.vel.y + (desired.y - this.vel.y) * blend
        }
        this.pos = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt }
        if (Math.hypot(this.vel.x, this.vel.y) > 1) this.heading = Math.atan2(this.vel.y, this.vel.x)
        this.flapPhase += dt * FLAP_RATE
        this.meanderPhase += dt * this.meanderRate
    }

    private meanderAmplitude(arriving: boolean, dist: number): number {
        if (!arriving) return this.speed * MEANDER_DEPARTING
        return this.speed * MEANDER_ARRIVING * Math.min(1, dist / MEANDER_SETTLE_RADIUS)
    }

    private land() {
        this.pos = { ...this.spot }
        this.vel = { x: 0, y: 0 }
        this.mode = 'landed'
        this.facing = Math.cos(this.heading) >= 0 ? 1 : -1
        this.restlessness = this.nextRestlessness()
        this.chooseBehavior()
    }

    private scavenge(dt: number) {
        this.behaviorTimer -= dt
        if (this.behavior === 'peck') {
            const progress = 1 - this.behaviorTimer / this.behaviorDuration
            this.peckTilt = PECK_TILT * Math.sin(Math.PI * clamp(progress, 0, 1))
        }
        if (this.behaviorTimer <= 0) this.chooseBehavior()
    }

    private chooseBehavior() {
        this.peckTilt = 0
        this.behavior = this.weightedBehavior()
        switch (this.behavior) {
            case 'idle':
                this.behaviorDuration = between(this.random, 0.6, 1.8)
                if (this.random() < 0.2) this.facing = this.facing === 1 ? -1 : 1
                break
            case 'peck':
                this.behaviorDuration = between(this.random, 0.3, 0.6)
                break
        }
        this.behaviorTimer = this.behaviorDuration
    }

    nextRestlessness(): number {
        return between(this.random, 4, 10)
    }

    private weightedBehavior(): GroundBehavior {
        const total = this.behaviors.reduce((sum, entry) => sum + entry.weight, 0)
        let roll = this.random() * total
        for (const entry of this.behaviors) {
            roll -= entry.weight
            if (roll <= 0) return entry.kind
        }
        return this.behaviors[this.behaviors.length - 1].kind
    }
}

export class LandingZone {
    constructor(readonly rects: BoundingBox[]) {}

    get centerY(): number {
        const top = Math.min(...this.rects.map((rect) => rect.y))
        const bottom = Math.max(...this.rects.map((rect) => rect.y + rect.height))
        return (top + bottom) / 2
    }

    contains(point: Point): boolean {
        return this.rects.some(
            ({ x, y, width, height }) =>
                point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
        )
    }

    samplePoint(random: RandomFunction): Point {
        const { x, y, width, height } = this.rects[Math.floor(random() * this.rects.length)]
        return { x: x + random() * width, y: y + random() * height }
    }
}

// Zone indexes run across `cells` then `nearbyCells`, so the director can map an occupied zone
// back to its field.
export class Flock {
    readonly birds: Bird[]
    readonly zones: LandingZone[]
    readonly zone: LandingZone
    leaving = false
    startled = false

    constructor(
        private readonly params: FlockParams,
        private readonly random: RandomFunction
    ) {
        const landingRects = params.cells.map((cell) => this.inset(cell))
        this.zones = [...landingRects, ...params.nearbyCells.map((cell) => this.inset(cell))].map(
            (rect) => new LandingZone([rect])
        )
        this.zone = new LandingZone(this.zones.map((zone) => zone.rects[0]))
        const landingZone = new LandingZone(landingRects)
        const spots = this.landingSpots(params.size, landingZone)
        const centerY = landingZone.centerY
        this.birds = spots.map((spot, index) => {
            const edgeX = params.entrySide === 'left' ? -CLIP_X : params.boardWidth + CLIP_X
            const trail = TRAIL_SPACING * index * (params.entrySide === 'left' ? -1 : 1)
            const start = {
                x: edgeX + trail,
                y: clamp(centerY + (random() - 0.5) * 50, 20, params.boardHeight - 20)
            }
            return new Bird(index, start, spot, this.zoneIndexOf(spot), random)
        })
    }

    get isGone(): boolean {
        return this.birds.every((bird) => bird.mode === 'gone')
    }

    occupiedZoneIndexes(): Set<number> {
        const indexes = new Set<number>()
        for (const bird of this.birds) {
            if (bird.mode === 'arriving' || bird.mode === 'landed' || bird.mode === 'relocating') {
                indexes.add(bird.zoneIndex)
            }
        }
        return indexes
    }

    step(dt: number) {
        for (const bird of this.birds) bird.step(dt, this)
        for (const bird of this.birds) {
            if (bird.mode === 'gone') continue
            for (const other of this.birds) {
                if (other !== bird && other.mode !== 'gone') bird.separateFrom(other, dt)
            }
        }
    }

    beginLeaving() {
        if (this.leaving) return
        this.leaving = true
        for (const bird of this.birds) {
            if (bird.reactionDelay === Infinity) bird.reactionDelay = between(this.random, 0.15, 0.6)
        }
    }

    startle() {
        this.startled = true
        this.leaving = true
        for (const bird of this.birds) {
            if (bird.mode !== 'departing' && bird.mode !== 'gone') {
                bird.reactionDelay = this.random() * 0.1
            }
        }
    }

    relocate(bird: Bird) {
        const choices = this.zones
            .map((zone, index) => ({ zone, index }))
            .filter(({ index }) => index !== bird.zoneIndex)
        if (choices.length === 0) {
            bird.restlessness = bird.nextRestlessness()
            return
        }
        const { zone, index } = choices[Math.floor(this.random() * choices.length)]
        bird.flyTo(this.freeSpotIn(zone), index)
    }

    exitPointFor(bird: Bird): Point {
        const { exitSide, boardWidth } = this.params
        const rise = between(this.random, 60, 120)
        return {
            x: exitSide === 'left' ? -CLIP_X - 10 : boardWidth + CLIP_X + 10,
            y: Math.max(-10, this.zone.centerY - rise + (bird.id % 3) * 4)
        }
    }

    isBeyondClip(point: Point): boolean {
        return point.x < -CLIP_X || point.x > this.params.boardWidth + CLIP_X || point.y < -CLIP_Y
    }

    private inset(cell: BoundingBox): BoundingBox {
        return {
            x: cell.x + ZONE_INSET,
            y: cell.y + ZONE_INSET,
            width: cell.width - ZONE_INSET * 2,
            height: cell.height - ZONE_INSET * 2
        }
    }

    private zoneIndexOf(point: Point): number {
        const index = this.zones.findIndex((zone) => zone.contains(point))
        assert(index >= 0, 'Landing spots are sampled inside a landing zone')
        return index
    }

    private landingSpots(count: number, zone: LandingZone): Point[] {
        const spots: Point[] = []
        for (let i = 0; i < count; i++) spots.push(this.freeSpotIn(zone, spots))
        return spots
    }

    private freeSpotIn(zone: LandingZone, taken = this.birds.map((bird) => bird.spot)): Point {
        let candidate = zone.samplePoint(this.random)
        for (let attempt = 0; attempt < 12; attempt++) {
            if (taken.every((spot) => distance(spot, candidate) >= LANDING_SPACING)) break
            candidate = zone.samplePoint(this.random)
        }
        return candidate
    }
}
