import type { Point } from '@tabletop/common'
import {
    BONUSES,
    cityById,
    type CityId,
    type ConnectionBonus,
    type ConnectionClaim,
    type MapId
} from '@tabletop/ride-the-rails'
import { hexOutline } from './boardGeometry.js'

// R-8 (Intercolonial, Greater Germany): a map's connection bonus, its chip in the turn line and
// the gold rings on its link cities, all read from the logic's bonus table.

/** The map's connection bonus, if its bonuses include one. */
export function connectionBonus(mapId: MapId): ConnectionBonus | undefined {
    return BONUSES[mapId].flatMap((bonus) => ('cityIds' in bonus ? [bonus] : []))[0]
}

/** The Transcontinental chip's twin: the bonus's name and amount, and its claim. */
export type ConnectionChipView = {
    name: string
    amount: number
    claim: ConnectionClaim | undefined
}

export function connectionChip(
    mapId: MapId,
    claim: ConnectionClaim | undefined
): ConnectionChipView | undefined {
    const bonus = connectionBonus(mapId)
    if (!bonus) return undefined
    return { name: bonus.printedName, amount: bonus.amount, claim }
}

/**
 * A gold ring round each link city while the bonus is open, just outside the hex's edge, as the
 * $5 ring is: its inside lies on the edge, so it reaches 0 to 4 units beyond it.
 */
export const LINK_RING = { width: 4 } as const

export type LinkRing = { cityId: CityId; loop: readonly Point[] }

export function linkRings(mapId: MapId, claim: ConnectionClaim | undefined): LinkRing[] {
    const bonus = connectionBonus(mapId)
    if (!bonus || claim) return []
    return bonus.cityIds.map((cityId) => ({
        cityId,
        loop: outsetLoop(hexOutline(cityById(cityId).hexId), LINK_RING.width / 2)
    }))
}

/**
 * A closed loop moved outwards by `distance` along every side, its corners mitred: each corner
 * goes where its two moved sides meet, whether it turns outwards or, between Berlin's two cells,
 * inwards.
 */
export function outsetLoop(loop: readonly Point[], distance: number): Point[] {
    const signedArea = loop.reduce((sum, from, index) => {
        const to = loop[(index + 1) % loop.length]
        return sum + from.x * to.y - to.x * from.y
    }, 0)
    // With y down, a loop of positive area runs clockwise, and its outside lies to each side's left.
    const turn = signedArea > 0 ? 1 : -1
    const normals = loop.map((from, index) => {
        const to = loop[(index + 1) % loop.length]
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        return { x: (turn * (to.y - from.y)) / length, y: (turn * (from.x - to.x)) / length }
    })
    return loop.map((corner, index) => {
        const before = normals[(index + loop.length - 1) % loop.length]
        const after = normals[index]
        const scale = distance / (1 + before.x * after.x + before.y * after.y)
        return {
            x: corner.x + (before.x + after.x) * scale,
            y: corner.y + (before.y + after.y) * scale
        }
    })
}
