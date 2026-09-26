import type { Point } from '@tabletop/common'

// Only what resolving an origin needs, so tests can supply a stand-in without a cast.
export type OriginElement = Pick<HTMLElement, 'isConnected' | 'getBoundingClientRect'>

// Where a politics splay looks like it comes from. Holds the clicked deck element while that
// deck is holding its slot, so a row resized during the host's round trip moves the origin with
// it; settlePoliticsPileOrigin then fixes it as a point once the deal starts, so history
// navigation still has an origin after the deck has left the page, and the element is released.
export type PoliticsPileOriginHandle = { element?: OriginElement; point?: Point }

export function resolvePoliticsPileOrigin(handle: PoliticsPileOriginHandle): Point | undefined {
    const { element } = handle
    if (!element?.isConnected) return handle.point

    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

export function settlePoliticsPileOrigin(handle: PoliticsPileOriginHandle): Point | undefined {
    const point = resolvePoliticsPileOrigin(handle)
    if (point) {
        handle.point = point
        handle.element = undefined
    }
    return point
}
