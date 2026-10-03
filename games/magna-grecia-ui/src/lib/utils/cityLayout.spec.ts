import { describe, expect, it } from 'vitest'
import { PointyHexDirection } from '@tabletop/common'
import { neighborCoords, offsetToAxial } from '@tabletop/magna-grecia'
import { HEX, hexCenter } from './boardGeometry.js'
import { cityLayout } from './cityLayout.js'

const founding = offsetToAxial({ row: 2, col: 3 })
const east = neighborCoords(founding, PointyHexDirection.East)
const southeast = neighborCoords(founding, PointyHexDirection.Southeast)
const southwest = neighborCoords(founding, PointyHexDirection.Southwest)

describe('city layout', () => {
    it('outlines a lone tile on all six sides and raises its temple above the centre', () => {
        const layout = cityLayout([founding], founding)

        expect(layout.edges).toHaveLength(6)
        expect(layout.temple).toEqual({ x: hexCenter(founding).x, y: hexCenter(founding).y - 10 })
    })

    it('leaves the edges between a city’s own tiles open', () => {
        const layout = cityLayout([founding, east, southeast], founding)

        expect(layout.edges).toHaveLength(12)
    })

    it('keeps every house inside the city and clear of its outer edges', () => {
        const spaces = [founding, east, southeast, southwest]
        const layout = cityLayout(spaces, founding)

        expect(layout.houses.length).toBeGreaterThan(40)
        for (const { center } of layout.houses) {
            const nearest = Math.min(
                ...spaces.map((tile) => {
                    const { x, y } = hexCenter(tile)
                    return Math.hypot(center.x - x, center.y - y)
                })
            )
            expect(nearest).toBeLessThan(HEX.yRadius)
        }
    })

    it('draws an extension tile’s houses on the terraces of the city it joins', () => {
        const city = cityLayout([founding, east], founding)
        const ghost = cityLayout([east], founding)

        expect(ghost.temple).toBeUndefined()
        const cityCenters = city.houses.map(({ center }) => `${center.x},${center.y}`)
        for (const { center } of ghost.houses) {
            expect(cityCenters).toContain(`${center.x},${center.y}`)
        }
    })
})
