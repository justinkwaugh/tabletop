import type { Point } from '$lib/utils/boardGeometry.js'
import {
    NoBoardOffer,
    roleOf,
    type BoardOffer,
    type BoardRole,
    type BoardTarget
} from './boardOffer.js'
import type { StackViewOf } from './tableLayers.svelte.js'

/** What a board layer draws its chrome from, and where its presses go. It decides nothing. */
export interface BoardChrome {
    readonly offer: BoardOffer
    /** Menu pointer: what the panel row under the pointer would light. */
    readonly bright: ReadonlySet<BoardTarget>
    /** A lit element's press. */
    readonly press?: (target: BoardTarget) => void
    /** An unlit stack or deck enlarges to its stack view. */
    readonly openStack?: (view: StackViewOf) => void
}

/** The board at rest: no offer, no presses. The layers' own specs and the bench read this. */
export const PlainChrome: BoardChrome = { offer: NoBoardOffer, bright: new Set() }

/** How far a dimmed element fades into the ground. */
const DimOpacity = 0.4

/** The contract's dimming for an element a target names; plain stays as it is. */
export function dimmed(role: BoardRole): number | undefined {
    return role === 'dimmed' ? DimOpacity : undefined
}

/** For what no target names: it dims with the rest while a map pick is open for this seat. */
export function dimmedWithRest({ offer }: BoardChrome): number | undefined {
    return offer.dimsRest ? DimOpacity : undefined
}

/** An element standing for several targets dims only when each of them does. */
export function dimmedUnlessAny(
    { offer }: BoardChrome,
    targets: readonly BoardTarget[]
): number | undefined {
    return targets.every((target) => roleOf(offer, target) === 'dimmed') ? DimOpacity : undefined
}

/** A press on the element would pick: it takes no enlarge, and what lies over it lets it through. */
export function isPickable(role: BoardRole): boolean {
    return role === 'lit' || role === 'picked'
}

/** Under an open pick a dimmed element stays dimmed (contract: Hover). */
export function isBright(chrome: BoardChrome, target: BoardTarget): boolean {
    return chrome.bright.has(target) && roleOf(chrome.offer, target) !== 'dimmed'
}

/** R-3.7.4 Each pilfer offered at a space, in the offer's order, as a row above it. */
export function pilfersAt(offer: BoardOffer, spaceId: string): readonly BoardTarget[] {
    return [...offer.targets.keys()].filter((target) => target.startsWith(`pilfer:${spaceId}:`))
}

const PilferStep = 44
const PilferRise = 66

export function pilferPlace(centre: Point, index: number, count: number): Point {
    return {
        x: centre.x + (index - (count - 1) / 2) * PilferStep,
        y: centre.y - PilferRise
    }
}
