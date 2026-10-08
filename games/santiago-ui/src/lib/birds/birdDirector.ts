import type { BoundingBox, RandomFunction } from '@tabletop/common'
import type { BoardSquare, Intersection } from '@tabletop/santiago'
import { BORDER_X, BORDER_Y, CELL_H, CELL_W, COL_STARTS, H, ROW_STARTS, W } from '$lib/utils/boardGeometry.js'
import {
    adjacentCandidates,
    candidateFields,
    isCandidateField,
    nearbyCandidates
} from './candidateFields.js'
import { Flock, type BirdPose } from './flock.js'
import { Kettle, KETTLE_REACH } from './kettle.js'
import { desertFields, desertDominates, isDesertField } from './desertFields.js'

const IDLE_MIN_MS = 30_000
const IDLE_MAX_MS = 90_000
const MAX_DT = 0.05
const MIN_FLOCK = 3
const MAX_FLOCK = 6
const PAIR_CHANCE = 0.5
const BIRD_SCALE = 1.1
const VULTURE_SCALE = 0.5
const VULTURE_HALF_SPAN = 10.2 * VULTURE_SCALE

export type TickCallback = (deltaMs: number) => void

export interface Ticker {
    add(callback: TickCallback): void
    remove(callback: TickCallback): void
}

export type BirdHost = {
    readonly isViewingHistory: boolean
    readonly gameState: { readonly board: { readonly squares: BoardSquare[][] } }
}

export type BirdEnvironment = {
    random: RandomFunction
    ticker: Ticker
    isHidden(): boolean
    prefersReducedMotion(): boolean
    onVisibilityChange(listener: (hidden: boolean) => void): () => void
}

type RenderedPose = BirdPose | 'vulture'

export type PresenceListener = (birdIds: number[]) => void

class RafTicker implements Ticker {
    private readonly callbacks = new Set<TickCallback>()
    private frame: number | undefined
    private last = 0
    private readonly loop: (now: number) => void

    constructor() {
        this.loop = this.onFrame.bind(this)
    }

    add(callback: TickCallback) {
        this.callbacks.add(callback)
        if (this.frame === undefined) {
            this.last = performance.now()
            this.frame = requestAnimationFrame(this.loop)
        }
    }

    remove(callback: TickCallback) {
        this.callbacks.delete(callback)
        if (this.callbacks.size === 0 && this.frame !== undefined) {
            cancelAnimationFrame(this.frame)
            this.frame = undefined
        }
    }

    private onFrame(now: number) {
        const delta = now - this.last
        this.last = now
        for (const callback of this.callbacks) callback(delta)
        this.frame = this.callbacks.size > 0 ? requestAnimationFrame(this.loop) : undefined
    }
}

export function browserBirdEnvironment(): BirdEnvironment {
    return {
        random: Math.random,
        ticker: new RafTicker(),
        isHidden: () => document.hidden,
        prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onVisibilityChange(listener) {
            const handler = () => listener(document.hidden)
            document.addEventListener('visibilitychange', handler)
            return () => document.removeEventListener('visibilitychange', handler)
        }
    }
}

// Ambient presentation outside the shared AnimationContext: it owns its own ticker and writes the
// birds' transforms straight to their SVG nodes; reactive state carries only the flock's presence.
export class BirdDirector {
    private flock: Flock | undefined
    private kettle: Kettle | undefined
    private kettleSquare: Intersection | undefined
    private fields: Intersection[] = []
    private readonly nodes = new Map<number, SVGGElement>()
    private readonly poses = new Map<number, RenderedPose>()
    private idleTimer: ReturnType<typeof setTimeout> | undefined
    private publish: PresenceListener = () => {}
    private stopWatchingVisibility: (() => void) | undefined
    private readonly tick: TickCallback

    constructor(
        private readonly host: BirdHost,
        private readonly env: BirdEnvironment = browserBirdEnvironment()
    ) {
        this.tick = this.onTick.bind(this)
    }

    get hasFlock(): boolean {
        return this.flock !== undefined
    }

    get hasKettle(): boolean {
        return this.kettle !== undefined
    }

    attach(onPresence: PresenceListener): () => void {
        this.detach()
        this.publish = onPresence
        this.stopWatchingVisibility = this.env.onVisibilityChange((hidden) => {
            if (hidden) this.stop()
            else this.scheduleVisit()
        })
        this.scheduleVisit()
        return () => this.detach()
    }

    summon(): boolean {
        if (this.flock || this.kettle) return false
        this.clearIdleTimer()
        return this.tryVisit()
    }

    setBirdNode(id: number, element?: SVGGElement) {
        if (element) this.nodes.set(id, element)
        else this.nodes.delete(id)
    }

    private scheduleVisit() {
        this.clearIdleTimer()
        const delay = IDLE_MIN_MS + this.env.random() * (IDLE_MAX_MS - IDLE_MIN_MS)
        this.idleTimer = setTimeout(() => this.tryVisit(), delay)
    }

    private clearIdleTimer() {
        if (this.idleTimer !== undefined) clearTimeout(this.idleTimer)
        this.idleTimer = undefined
    }

    private tryVisit(): boolean {
        const suppressed =
            this.host.isViewingHistory ||
            this.env.isHidden() ||
            this.env.prefersReducedMotion()
        const squares = this.host.gameState.board.squares
        if (!suppressed && desertDominates(squares)) {
            const roomy = desertFields(squares).filter((square) => this.hasRoomToCircle(square))
            if (roomy.length === 0) {
                this.scheduleVisit()
                return false
            }
            this.spawnKettle(roomy[Math.floor(this.env.random() * roomy.length)])
            return true
        }
        const candidates = suppressed ? [] : candidateFields(squares)
        if (candidates.length === 0) {
            this.scheduleVisit()
            return false
        }
        this.spawn(candidates[Math.floor(this.env.random() * candidates.length)])
        return true
    }

    private spawnKettle(target: Intersection) {
        const cell = this.cellRect(target)
        this.kettleSquare = target
        const center = { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }
        this.kettle = new Kettle(
            {
                center,
                // Vultures glide in slowly, so they come from the nearer side.
                entrySide: center.x < W / 2 ? 'left' : 'right',
                exitSide: this.env.random() < 0.5 ? 'left' : 'right',
                size: 1,
                boardWidth: W,
                boardHeight: H
            },
            this.env.random
        )
        this.publish(this.kettle.vultures.map((vulture) => vulture.id))
        this.env.ticker.add(this.tick)
    }

    private spawn(target: Intersection) {
        const squares = this.host.gameState.board.squares
        const targets = [target, ...this.companionFor(target)]
        const nearby = nearbyCandidates(squares, targets)
        this.fields = [...targets, ...nearby]
        this.flock = new Flock(
            {
                cells: targets.map((field) => this.cellRect(field)),
                nearbyCells: nearby.map((field) => this.cellRect(field)),
                entrySide: this.env.random() < 0.5 ? 'left' : 'right',
                exitSide: this.env.random() < 0.5 ? 'left' : 'right',
                size: MIN_FLOCK + Math.floor(this.env.random() * (MAX_FLOCK - MIN_FLOCK + 1)),
                boardWidth: W,
                boardHeight: H
            },
            this.env.random
        )
        this.publish(this.flock.birds.map((bird) => bird.id))
        this.env.ticker.add(this.tick)
    }

    private onTick(deltaMs: number) {
        const dt = Math.max(0, Math.min(deltaMs / 1000, MAX_DT))
        const kettle = this.kettle
        if (kettle) {
            if (!kettle.leaving && this.kettleShouldLeave()) kettle.startle()
            kettle.step(dt)
            this.renderKettle(kettle)
            if (kettle.isGone) {
                this.clearFlock()
                this.scheduleVisit()
            }
            return
        }
        const flock = this.flock
        if (!flock) return
        if (!flock.leaving && this.shouldStartle(flock)) flock.startle()
        flock.step(dt)
        this.render(flock)
        if (flock.isGone) {
            this.clearFlock()
            this.scheduleVisit()
        }
    }

    private companionFor(target: Intersection): Intersection[] {
        const neighbours = adjacentCandidates(this.host.gameState.board.squares, target)
        if (neighbours.length === 0 || this.env.random() >= PAIR_CHANCE) return []
        return [neighbours[Math.floor(this.env.random() * neighbours.length)]]
    }

    private cellRect(field: Intersection): BoundingBox {
        return {
            x: BORDER_X + COL_STARTS[field.col],
            y: BORDER_Y + ROW_STARTS[field.row],
            width: CELL_W,
            height: CELL_H
        }
    }

    private shouldStartle(flock: Flock): boolean {
        if (this.host.isViewingHistory) return true
        const squares = this.host.gameState.board.squares
        for (const index of flock.occupiedZoneIndexes()) {
            const field = this.fields[index]
            if (!isCandidateField(squares[field.col][field.row])) return true
        }
        return false
    }

    // A square whose kettle stays on the board while wheeling, so the vultures are never clipped.
    private hasRoomToCircle(square: Intersection): boolean {
        const cell = this.cellRect(square)
        const x = cell.x + cell.width / 2
        const y = cell.y + cell.height / 2
        const margin = KETTLE_REACH + VULTURE_HALF_SPAN
        return x >= margin && x <= W - margin && y >= margin && y <= H - margin
    }

    private kettleShouldLeave(): boolean {
        if (this.host.isViewingHistory) return true
        const square = this.kettleSquare
        return square === undefined || !isDesertField(this.host.gameState.board.squares[square.col][square.row])
    }

    private renderKettle(kettle: Kettle) {
        for (const vulture of kettle.vultures) {
            const node = this.nodes.get(vulture.id)
            if (!node) continue
            node.setAttribute('visibility', vulture.mode === 'gone' ? 'hidden' : 'visible')
            if (vulture.mode === 'gone') continue
            const { x, y } = vulture.pos
            node.setAttribute(
                'transform',
                `translate(${x} ${y}) rotate(${(vulture.heading * 180) / Math.PI}) scale(${VULTURE_SCALE})`
            )
            if (this.poses.get(vulture.id) !== 'vulture') {
                this.poses.set(vulture.id, 'vulture')
                node.dataset.pose = 'vulture'
            }
        }
    }

    private render(flock: Flock) {
        for (const bird of flock.birds) {
            const node = this.nodes.get(bird.id)
            if (!node) continue
            node.setAttribute('visibility', bird.mode === 'gone' ? 'hidden' : 'visible')
            if (bird.mode === 'gone') continue
            const { x, y } = bird.pos
            node.setAttribute(
                'transform',
                bird.mode === 'landed'
                    ? `translate(${x} ${y}) scale(${bird.facing * BIRD_SCALE} ${BIRD_SCALE}) rotate(${bird.peckTilt})`
                    : `translate(${x} ${y}) rotate(${(bird.heading * 180) / Math.PI}) scale(${BIRD_SCALE})`
            )
            const pose = bird.pose
            if (this.poses.get(bird.id) !== pose) {
                this.poses.set(bird.id, pose)
                node.dataset.pose = pose
            }
        }
    }

    private stop() {
        this.clearIdleTimer()
        this.clearFlock()
    }

    private clearFlock() {
        if (this.flock || this.kettle) this.env.ticker.remove(this.tick)
        this.flock = undefined
        this.kettle = undefined
        this.kettleSquare = undefined
        this.fields = []
        this.poses.clear()
        this.publish([])
    }

    private detach() {
        this.stop()
        this.stopWatchingVisibility?.()
        this.stopWatchingVisibility = undefined
        this.nodes.clear()
        this.publish = () => {}
    }
}
