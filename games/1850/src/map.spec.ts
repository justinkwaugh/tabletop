import { describe, expect, it } from 'vitest'
import { Companies1850 } from './companies.js'
import { Map1850, NorthwestLocationIds, WestOfMississippi } from './map.js'
import { TileSet1850 } from './tiles.js'

describe('the map', () => {
    it('has every company’s home and edge area', () => {
        const ids = Map1850.definition.locations.map((location) => location.id)
        for (const company of Companies1850) {
            expect(ids).toContain(company.home)
            if (company.edgeArea) expect(ids).toContain(company.edgeArea)
            expect(Map1850.reservedLocationIds(company.id)).toEqual([company.home])
        }
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('has as fixed hexes only the edge areas, the Mesabi Range and the link east of Chicago', () => {
        expect(
            Map1850.definition.locations
                .filter((location) => !location.buildable)
                .map(({ id }) => id)
                .sort()
        ).toEqual(['A10', 'A2', 'B1', 'C20', 'F1', 'I20', 'K20', 'M2', 'M20'])
    })

    it('counts the Northwest as one stop across its two hexes (§7.4)', () => {
        for (const id of NorthwestLocationIds)
            expect(Map1850.location(id).stopGroup).toBe('Northwest')
    })

    it('keeps every hex west of the Mississippi on the map, and buildable', () => {
        for (const id of WestOfMississippi) expect(Map1850.location(id).buildable).toBe(true)
    })

    it('prices rivers at $40 and the mountain at $60', () => {
        expect(Map1850.location('A12').terrain).toEqual({ cost: 60, kinds: ['mountain'] })
        for (const id of ['B13', 'D9', 'E10', 'G18', 'I18', 'L13'])
            expect(Map1850.location(id).terrain?.cost).toBe(40)
        expect(Map1850.location('H11').terrain).toBeUndefined()
    })

    it('prints only the tile manifest’s counts (§22)', () => {
        const count = (number: string) =>
            TileSet1850.pieces.filter((piece) =>
                piece.faceDefinitionIds.some((id) => id.endsWith(`:${number}`))
            ).length
        expect(['7', '8', '9', '57', '135', '138'].map(count)).toEqual([6, 20, 20, 5, 3, 2])
    })
})
