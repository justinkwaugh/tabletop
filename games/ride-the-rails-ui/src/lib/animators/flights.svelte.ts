import { gsap } from 'gsap'
import type { CityId, HexId, RailroadId } from '@tabletop/ride-the-rails'
import type { AnimationContext } from '@tabletop/frontend-components'

/** Where a travelling piece is drawn: its centre, its scale and its opacity. */
export type Pose = { x: number; y: number; scale: number; opacity: number }

/**
 * Contract, Shared visual state, Animation transients: what the flight layer draws. Each flyer is
 * drawn centred on its outer wrapper's origin, so a pose moves and scales it about its centre. A
 * locomotive that `leavesTheMap` (a share) never lands in a slot, so a phone draws it, like a
 * coin, no smaller than it can be read.
 */
export type Flyer =
    | {
          key: string
          kind: 'locomotive'
          railroadId: RailroadId
          width: number
          pose: Pose
          leavesTheMap?: boolean
      }
    | { key: string; kind: 'coin'; amount: number; gold: boolean; pose: Pose }
    | { key: string; kind: 'outline'; hexId: HexId; pose: Pose }
    | { key: string; kind: 'line'; hexIds: readonly HexId[]; pose: Pose }
    | { key: string; kind: 'passenger'; pose: Pose }
    | { key: string; kind: 'pulse'; radius: number; pose: Pose }

export function moneyKey(playerId: string): string {
    return `money:${playerId}`
}

export function supplyKey(railroadId: RailroadId): string {
    return `supply:${railroadId}`
}

/** A seat's card, where a share flight lands. */
export function seatCardKey(playerId: string): string {
    return `seat:${playerId}`
}

/** A share slot on a seat's card, where a share flight lands when the slot is drawn. */
export function shareSlotKey(playerId: string, slot: number): string {
    return `share-slot:${playerId}:${slot}`
}

/** The Transcontinental chip in the turn line, where the claim's coin lands. */
export const TRANSCONTINENTAL_KEY = 'transcontinental'

/** The round the table shows, ticked ahead of the state as the end of a round steps it. */
export const ROUND_KEY = 'round'

/** A round's ticket in the turn line, which hops as the round steps to it. */
export function roundTicketKey(round: number): string {
    return `round-ticket:${round}`
}

/** A railroad's desktop card, which brightens in when the end of a round makes it available. */
export function railroadEntryKey(railroadId: RailroadId): string {
    return `railroad-entry:${railroadId}`
}

export function sharesKey(playerId: string, railroadId: RailroadId): string {
    return `shares:${playerId}:${railroadId}`
}

/** A locomotive on the board, which slides to its new slot as its hex regroups (Pattern A). */
export function trackPieceKey(pieceKey: string): string {
    return `track:${pieceKey}`
}

/** The seat bar under a locomotive placed this building turn, which slides with it. */
export function trackBarKey(pieceKey: string): string {
    return `track-bar:${pieceKey}`
}

/** A city's waiting passenger, hidden on the passenger layer while a flyer draws it. */
export function passengerKey(cityId: CityId): string {
    return `passenger:${cityId}`
}

/** What the animators write on: a flyer's outer wrapper or one of the board's own elements. */
export type FlightTarget = Pick<SVGElement, 'getAttribute' | 'setAttribute' | 'removeAttribute'>

/** Writes a pose as a plain `translate(...) scale(...)`, never through GSAP's SVG transforms. */
export function writePose(element: FlightTarget | undefined, pose: Pose) {
    if (!element) return
    element.setAttribute('transform', poseTransform(pose))
    element.setAttribute('opacity', String(pose.opacity))
}

export function poseTransform(pose: Pose): string {
    return `translate(${pose.x} ${pose.y}) scale(${pose.scale})`
}

/**
 * The flight layer's transient state. The state-change animators write presence (flyers, hidden
 * locomotives, ticked counts) and tween each flyer's pose; the board reads it. Everything here
 * describes the transition under way, so it all goes when a new Game State is shown, when an
 * Undo interrupts the motion, and when the board is torn down.
 */
export class Flights {
    flyers: readonly Flyer[] = $state.raw([])
    /** Locomotives on the shown state that an Undo is taking away; the flight layer shrinks a copy. */
    hiddenKeys: ReadonlySet<string> = $state.raw(new Set())
    /** Counts and money that have ticked ahead of the shown state (Pattern D). */
    private values: ReadonlyMap<string, number> = $state.raw(new Map())

    /** Set by an interruption until the next Game State is shown: later steps move nothing. */
    interrupted = false

    private readonly elements = new Map<string, FlightTarget>()
    /** The title's table while it is drawn: where a flight looks for its landing. */
    table: Element | undefined = undefined
    private readonly contexts = new Set<AnimationContext>()
    /** Attributes the animators wrote on the board's own elements (Pattern A), to put back. */
    private readonly written = new Map<string, Map<string, string | null>>()

    show(flyers: readonly Flyer[]) {
        const keys = new Set(flyers.map((flyer) => flyer.key))
        this.flyers = [...this.flyers.filter((flyer) => !keys.has(flyer.key)), ...flyers]
    }

    remove(keys: readonly string[]) {
        const gone = new Set(keys)
        this.flyers = this.flyers.filter((flyer) => !gone.has(flyer.key))
    }

    hide(keys: readonly string[]) {
        this.hiddenKeys = new Set([...this.hiddenKeys, ...keys])
    }

    tick(key: string, value: number) {
        this.values = new Map(this.values).set(key, value)
    }

    /** A count as the board shows it: ticked ahead of the shown state while a flight lands. */
    shown(key: string, actual: number): number {
        return this.values.get(key) ?? actual
    }

    element(key: string): FlightTarget | undefined {
        return this.elements.get(key)
    }

    /**
     * Pattern A: writes an attribute on one of the board's own elements, remembering what it was.
     * Each one goes back when the new Game State is shown, which draws the element where the
     * motion left it, so the board never keeps a value the state did not give it.
     */
    write(key: string, attribute: string, value: string) {
        const element = this.elements.get(key)
        if (!element) return
        let attributes = this.written.get(key)
        if (!attributes) {
            attributes = new Map()
            this.written.set(key, attributes)
        }
        if (!attributes.has(attribute)) attributes.set(attribute, element.getAttribute(attribute))
        element.setAttribute(attribute, value)
    }

    /** A `use:` action that keeps a flyer's outer wrapper by its key. */
    readonly register = (node: FlightTarget, key: string) => {
        let current = key
        this.elements.set(current, node)
        return {
            update: (next: string) => {
                if (this.elements.get(current) === node) this.elements.delete(current)
                current = next
                this.elements.set(current, node)
            },
            destroy: () => {
                if (this.elements.get(current) === node) this.elements.delete(current)
            }
        }
    }

    /** An attachment that holds the title's table while it is drawn (`tableScope`). */
    readonly attachTable = (node: Element) => {
        this.table = node
        return () => {
            if (this.table === node) this.table = undefined
        }
    }

    /** Remembers a step's timelines until they have played, so an interruption can end them. */
    follow(animationContext: AnimationContext) {
        if (this.contexts.has(animationContext)) return
        this.contexts.add(animationContext)
        animationContext.afterAnimations(() => this.contexts.delete(animationContext))
    }

    get moving(): boolean {
        return this.contexts.size > 0
    }

    /**
     * Contract, Verification scenario 23: ends the motion at once. A step already playing jumps
     * to its end, which settles it; one still being built loses its tweens. The steps after it in
     * the same transition move nothing, and the flight layer empties.
     */
    interrupt() {
        this.interrupted = true
        for (const animationContext of this.contexts) {
            const playing = animationContext.actionTimeline.parent
            if (playing && playing !== gsap.globalTimeline) {
                playing.progress(1)
            } else {
                animationContext.actionTimeline.clear()
                animationContext.finalTimeline.clear()
            }
        }
        this.contexts.clear()
        this.clear()
    }

    /** A new Game State is shown: it draws everything the flights were showing ahead of it. */
    settle() {
        this.interrupted = false
        this.clear()
    }

    teardown() {
        this.interrupt()
        this.interrupted = false
        this.elements.clear()
    }

    private clear() {
        for (const [key, attributes] of this.written) {
            const element = this.elements.get(key)
            for (const [attribute, value] of attributes) {
                if (value === null) element?.removeAttribute(attribute)
                else element?.setAttribute(attribute, value)
            }
        }
        this.written.clear()
        if (this.flyers.length > 0) this.flyers = []
        if (this.hiddenKeys.size > 0) this.hiddenKeys = new Set()
        if (this.values.size > 0) this.values = new Map()
    }
}
