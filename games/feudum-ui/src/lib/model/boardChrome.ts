import type { Point } from '@tabletop/common'
import type { SpaceId } from '@tabletop/feudum'
import {
    NoBoardOffer,
    roleOf,
    type BoardOffer,
    type BoardRole,
    type BoardTarget
} from './boardOffer.js'
import type { StackViewOf } from './tableLayers.svelte.js'

export interface BoardChrome {
    readonly offer: BoardOffer
    readonly bright: ReadonlySet<BoardTarget>
    readonly press?: (target: BoardTarget) => void
    readonly openStack?: (view: StackViewOf) => void
    readonly openSite?: (spaceId: SpaceId) => void
    readonly hoverSite?: (spaceId: SpaceId | undefined) => void
}

export const PlainChrome: BoardChrome = { offer: NoBoardOffer, bright: new Set() }

const DimOpacity = 0.4
/** A ground veil, since opacity on a raster's group costs WebKit a bitmap of the group's size. */
export const VeilOpacity = 1 - DimOpacity

export function dimmed(role: BoardRole): number | undefined {
    return role === 'dimmed' ? DimOpacity : undefined
}

export function dimmedWithRest({ offer }: BoardChrome): number | undefined {
    return offer.dimsRest ? DimOpacity : undefined
}

export function dimmedUnlessAny(
    { offer }: BoardChrome,
    targets: readonly BoardTarget[]
): number | undefined {
    return targets.every((target) => roleOf(offer, target) === 'dimmed') ? DimOpacity : undefined
}

export function isPickable(role: BoardRole): boolean {
    return role === 'lit' || role === 'picked'
}

/** Contract, Coexistence and precedence: under an open pick a dimmed element stays dimmed. */
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
