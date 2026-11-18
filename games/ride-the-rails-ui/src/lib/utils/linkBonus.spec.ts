import { describe, expect, it } from 'vitest'
import { assertExists, type Point } from '@tabletop/common'
import {
    ActionType,
    GREATER_GERMANY_BONUS,
    INTERCOLONIAL_BONUS,
    cityById,
    type ConnectionClaim,
    type MapId
} from '@tabletop/ride-the-rails'
import { hydrated, runAction } from '@tabletop/ride-the-rails/testing'
import { TABLE_FIXTURES, tableState } from '$lib/testing/tableFixtures.js'
import { hexCenter, hexOutline } from './boardGeometry.js'
import { LINK_RING, connectionChip, linkRings } from './linkBonus.js'

const NO_CONNECTION_BONUS: MapId[] = ['map.usa', 'map.au', 'map.fr']
const CLAIM: ConnectionClaim = { playerId: 'p2' }

describe('the connection bonus chip (R-8)', () => {
    it.each(NO_CONNECTION_BONUS)('is not shown on %s, which has no connection bonus', (mapId) => {
        expect(connectionChip(mapId, undefined)).toBeUndefined()
    })

    it('names the map’s bonus and its amount from the bonus table while open', () => {
        expect(connectionChip('map.ca', undefined)).toEqual({
            name: INTERCOLONIAL_BONUS.printedName,
            amount: INTERCOLONIAL_BONUS.amount,
            claim: undefined
        })
        expect(connectionChip('map.de', undefined)).toEqual({
            name: GREATER_GERMANY_BONUS.printedName,
            amount: GREATER_GERMANY_BONUS.amount,
            claim: undefined
        })
        expect(connectionChip('map.ca', undefined)?.name).toBe('Intercolonial')
        expect(connectionChip('map.de', undefined)?.amount).toBe(12)
    })

    it('shows the claim, its claimant and the amount paid, once claimed', () => {
        expect(connectionChip('map.ca', CLAIM)).toEqual({
            name: 'Intercolonial',
            amount: 8,
            claim: CLAIM
        })
    })
})

// The distance from a point to the line through a and b.
function lineDistance(point: Point, a: Point, b: Point): number {
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
    return Math.abs(cross) / Math.hypot(b.x - a.x, b.y - a.y)
}

// Even-odd ray casting, for any simple loop.
function insideLoop(point: Point, loop: readonly Point[]): boolean {
    let inside = false
    loop.forEach((from, index) => {
        const to = loop[(index + 1) % loop.length]
        if (from.y > point.y !== to.y > point.y) {
            const x = from.x + ((point.y - from.y) * (to.x - from.x)) / (to.y - from.y)
            if (point.x < x) inside = !inside
        }
    })
    return inside
}

describe('the link city rings (R-8)', () => {
    it('ring each link city of the map’s connection bonus while it is open', () => {
        expect(linkRings('map.ca', undefined).map((ring) => ring.cityId)).toEqual(
            INTERCOLONIAL_BONUS.cityIds
        )
        expect(linkRings('map.de', undefined).map((ring) => ring.cityId)).toEqual(
            GREATER_GERMANY_BONUS.cityIds
        )
        for (const mapId of NO_CONNECTION_BONUS) expect(linkRings(mapId, undefined)).toEqual([])
    })

    it('go once the bonus is claimed', () => {
        expect(linkRings('map.ca', CLAIM)).toEqual([])
        expect(linkRings('map.de', { playerId: 'p1' })).toEqual([])
    })

    it('stand just outside the hex, 4 wide, their inside on its edge', () => {
        expect(LINK_RING.width).toBe(4)
        for (const ring of [...linkRings('map.ca', undefined), ...linkRings('map.de', undefined)]) {
            const outline = hexOutline(cityById(ring.cityId).hexId)
            expect(ring.loop).toHaveLength(outline.length)
            // Each corner of the ring's middle line stands half its width off both sides that
            // meet at the hex's corner, outside the hex.
            ring.loop.forEach((point, index) => {
                const corner = outline[index]
                const before = outline[(index + outline.length - 1) % outline.length]
                const after = outline[(index + 1) % outline.length]
                expect(insideLoop(point, outline), ring.cityId).toBe(false)
                for (const side of [before, after]) {
                    expect(lineDistance(point, corner, side), ring.cityId).toBeCloseTo(
                        LINK_RING.width / 2,
                        6
                    )
                }
            })
        }
    })

    it('is a hexagon about a one-cell city’s centre, as the $5 ring is', () => {
        const [quebec] = linkRings('map.ca', undefined).filter(
            (ring) => ring.cityId === 'city.ca.quebec-city'
        )
        assertExists(quebec)
        const center = hexCenter(cityById(quebec.cityId).hexId)
        const radius = (40 * Math.cos(Math.PI / 6) + LINK_RING.width / 2) / Math.cos(Math.PI / 6)
        // The platform rounds a hex's corners to a tenth.
        for (const point of quebec.loop) {
            expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeCloseTo(radius, 1)
        }
    })

    it('follows Berlin’s two cells as one loop', () => {
        const [berlin] = linkRings('map.de', undefined).filter(
            (ring) => ring.cityId === 'city.de.berlin'
        )
        assertExists(berlin)
        // Two cells share one side: ten corners round the pair, two of them turning inwards.
        expect(hexOutline(cityById('city.de.berlin').hexId)).toHaveLength(10)
        expect(berlin.loop).toHaveLength(10)
    })
})

describe('the link scenarios (R-8.3, R-8.5)', () => {
    it.each([
        ['canada-link-in-reach', INTERCOLONIAL_BONUS, 'city.ca.toronto'],
        ['germany-link-in-reach', GREATER_GERMANY_BONUS, 'city.de.berlin']
    ] as const)('%s is one placement short: Yellow into %s claims it', (slug, bonus, cityId) => {
        const fixture = TABLE_FIXTURES.find((candidate) => candidate.slug === slug)
        assertExists(fixture)
        const from = tableState(fixture.recipe)
        expect(from.connectionClaim).toBeUndefined()
        expect(linkRings(from.mapId, from.connectionClaim)).toHaveLength(bonus.cityIds.length)

        const playerId = from.activePlayerIds[0]
        assertExists(playerId)
        const to = hydrated(
            runAction(from, {
                type: ActionType.PlaceLocomotive,
                playerId,
                railroadId: 'railroad.yellow',
                hexId: cityById(cityId).hexId
            }).after
        )
        expect(to.connectionClaim).toEqual({ playerId })
        expect(connectionChip(to.mapId, to.connectionClaim)?.claim?.playerId).toBe(playerId)
        expect(linkRings(to.mapId, to.connectionClaim)).toEqual([])
    })
})
