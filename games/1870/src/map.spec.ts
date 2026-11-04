import { describe, expect, it } from 'vitest'
import { TileUpgrades, rotateTileFace, type TileEdge, type TileRotation } from '@tabletop/18xx'
import { Companies1870 } from './companies.js'
import { Map1870, RiverHexes } from './map.js'
import { TileSet1870 } from './tiles.js'
import { TrackRules1870, crossesRiver } from './track.js'

const face = (number: string, rotation: TileRotation) => {
    const definition = TileSet1870.definitions.find((entry) => entry.printedNumber === number)
    if (!definition) throw new Error(`No tile ${number}`)
    return rotateTileFace(definition.face, rotation)
}
const exitsOf = (number: string, rotation: TileRotation): TileEdge[] =>
    face(number, rotation).paths.flatMap((path) =>
        path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
    )
const Rotations = [0, 1, 2, 3, 4, 5] as const

describe('the map', () => {
    it('has every company’s home and destination', () => {
        const ids = Map1870.definition.locations.map((location) => location.id)
        for (const company of Companies1870) {
            expect(ids).toContain(company.home)
            expect(ids).toContain(company.destination)
        }
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('prints the map’s 154 hexes, four of them offboards', () => {
        const locations = Map1870.definition.locations
        expect(locations).toHaveLength(154)
        expect(
            locations
                .filter((location) => !location.buildable)
                .map(({ id }) => id)
                .sort()
        ).toEqual(['A2', 'A22', 'M22', 'N1'])
    })

    it('has only the P cities take brown #170, and Kansas City and St. Louis their gray tiles', () => {
        const labels = (id: string) => Map1870.location(id).upgradeLabels
        for (const id of ['J3', 'J5', 'N17'])
            expect(labels(id)).toEqual([{ color: 'brown', label: 'P' }])
        expect(labels('B11')).toContainEqual({ color: 'gray', label: 'K' })
        expect(labels('C18')).toContainEqual({ color: 'gray', label: 'L' })
    })
})

describe('the Mississippi until the bridge is sold (p. 9)', () => {
    it('allows St. Louis only #5 facing west and southwest', () => {
        const river = RiverHexes.C18
        const legal = (number: string) =>
            Rotations.filter((rotation) => !crossesRiver(river, face(number, rotation)))
        expect(legal('6')).toEqual([])
        expect(legal('57')).toEqual([])
        expect(legal('5').map((rotation) => exitsOf('5', rotation).sort())).toEqual([[0, 1]])
    })

    it('allows Memphis track pointing northeast, east, southeast or southwest', () => {
        const river = RiverHexes.H17
        const permitted = new Set<number>([0, 3, 4, 5])
        for (const number of ['5', '6', '57', '15'])
            for (const rotation of Rotations)
                expect(crossesRiver(river, face(number, rotation))).toBe(
                    exitsOf(number, rotation).some((edge) => !permitted.has(edge))
                )
    })

    it('lets plain track run along either bank, not across', () => {
        const river = RiverHexes.J15
        expect(crossesRiver(river, face('9', 0))).toBe(true)
        expect(
            Rotations.some(
                (rotation) =>
                    !crossesRiver(river, face('7', rotation)) &&
                    exitsOf('7', rotation).every((edge) => [0, 1, 2].includes(edge))
            )
        ).toBe(true)
    })
})

describe('the tile manifest (p. 30)', () => {
    it('has 161 tiles', () => {
        const total = TileSet1870.counts(TileSet1870.createInventory()).reduce(
            (sum, entry) => sum + (entry.total === 'unlimited' ? 0 : entry.total),
            0
        )
        expect(total).toBe(161)
    })

    // The replacements printed (pp. 30, 32), with what preserving track also allows and the table
    // omits: #144 would otherwise replace nothing, and #43 keeps #28's and #29's track.
    const Replacements: Readonly<Record<string, readonly string[]>> = {
        '3': ['141', '142', '143'],
        '4': ['141', '142'],
        '5': ['14', '15'],
        '6': ['14', '15'],
        '7': ['18', '26', '27', '28', '29'],
        '8': ['16', '17', '19', '23', '24', '25', '28', '29'],
        '9': ['18', '19', '20', '23', '24', '26', '27'],
        '57': ['14', '15'],
        '58': ['141', '142', '143', '144'],
        '14': ['63', '170'],
        '15': ['63', '170'],
        '16': ['43', '70'],
        '17': ['47'],
        '18': ['43'],
        '19': ['45', '46'],
        '20': ['44', '47'],
        '23': ['41', '43', '45', '47'],
        '24': ['42', '43', '46', '47'],
        '25': ['40', '45', '46'],
        '26': ['42', '44', '45'],
        '27': ['41', '44', '46'],
        '28': ['39', '43', '46', '70'],
        '29': ['39', '43', '45', '70'],
        '141': ['145', '146', '147'],
        '142': ['145', '146', '147'],
        '143': ['146', '147'],
        '144': ['147'],
        '170': ['171', '172']
    }
    const Upgrades = new TileUpgrades(TrackRules1870)
    const definition = (number: string) => {
        const found = TileSet1870.definitions.find((entry) => entry.printedNumber === number)
        if (!found) throw new Error(`No tile ${number}`)
        return found
    }
    it.each(Object.entries(Replacements))('replaces #%s as printed', (number, printed) => {
        const before = definition(number)
        const candidates = Upgrades.upgradesTo(before.id)
            .map((id) => definition(id.split(':')[1]).printedNumber)
            .sort()
        expect(candidates).toEqual([...printed].sort())
    })
})
