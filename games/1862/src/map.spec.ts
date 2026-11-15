import { describe, expect, it } from 'vitest'
import { routeRevenue, type TileEdge } from '@tabletop/18xx'
import { Companies1862 } from './companies.js'
import {
    HarwichLocationId,
    IpswichLocationId,
    LondonLocationIds,
    LondonSpaceCount,
    LondonSpacesLocationId,
    LondonSpacesNodeId,
    Map1862,
    OffboardAreaIds,
    OffboardAreas,
    OffboardStages,
    PortLocationIds,
    RedOffboardLocationIds,
    offboardArea,
    offboardAreaLocationIds
} from './map.js'

const locations = Map1862.definition.locations
const land = locations.filter((location) => location.buildable)
const nodeKinds = (id: string) => Map1862.location(id).preprintedTile.nodes.map((node) => node.kind)
const labelled = (label: string) =>
    land
        .filter((location) => location.preprintedTile.labels.includes(label))
        .map((location) => location.id)
        .sort()

describe('the 1862 map', () => {
    it('prints every land hex as a village or one empty large station', () => {
        expect(land).toHaveLength(37)
        for (const location of land) {
            expect(location.preprintedTile.color).toBe('white')
            expect(location.preprintedTile.paths).toEqual([])
            const [node, ...rest] = location.preprintedTile.nodes
            expect(rest).toEqual([])
            if (node.kind === 'city') expect(node.stationSlots).toBe(1)
            else expect(node.kind).toBe('town')
        }
        expect(land.filter((location) => nodeKinds(location.id)[0] === 'town')).toHaveLength(12)
    })

    it('puts every company home on its own large station, reserved for nobody', () => {
        expect(Companies1862).toHaveLength(20)
        expect(new Set(Companies1862.map((company) => company.home)).size).toBe(20)
        for (const company of Companies1862) {
            expect(nodeKinds(company.home)).toEqual(['city'])
            expect(Map1862.reservedLocationIds(company.id)).toEqual([])
        }
        expect(Map1862.stationReservations()).toEqual([])
    })

    it('names every land hex with the rulebook spellings', () => {
        for (const location of land) expect(location.name).toBeDefined()
        expect(Map1862.placeName('E2')).toBe('Wells-next-the-Sea')
        expect(Map1862.placeName('D9')).toBe('Bury St Edmunds')
        expect(Map1862.placeName('G4')).toBe('North Walsham')
        expect(Map1862.placeName('C4')).toBe("King's Lynn")
        expect(Map1862.placeName(IpswichLocationId)).toBe('Ipswich')
        expect(Map1862.placeName(HarwichLocationId)).toBe('Harwich')
        expect(Map1862.placeName('A8')).toBe('Midlands & The West')
        expect(Map1862.placeName('G14')).toBe('Denmark & Holland')
    })

    it('letters the N and Y large stations, with Ipswich and Harwich russet-only labels', () => {
        expect(labelled('N')).toEqual(['B9', 'E12', 'F11', 'F5'])
        expect(labelled('Y')).toEqual(['C4', 'C8', 'D9', 'F13', 'H5'])
        expect(Map1862.location(IpswichLocationId).upgradeLabels).toEqual([
            { color: 'brown', label: 'I' }
        ])
        expect(Map1862.location(HarwichLocationId).upgradeLabels).toEqual([
            { color: 'brown', label: 'H' }
        ])
    })

    it('numbers flat edges from the south, clockwise', () => {
        const neighbor = (id: string, edge: TileEdge) => Map1862.neighbor(id, edge)?.id
        expect(([0, 1, 2, 3, 4, 5] as const).map((edge) => neighbor('D9', edge))).toEqual([
            'D11',
            'C10',
            'C8',
            'D7',
            'E8',
            'E10'
        ])
        expect(neighbor('A2', 5)).toBe('B3')
        expect(neighbor('E2', 3)).toBe('E0')
    })

    it('walls Harwich and the Ipswich and Tiptree sides with impassable borders', () => {
        const blocked = (id: string) =>
            ([0, 1, 2, 3, 4, 5] as const).filter(
                (edge) => Map1862.neighbor(id, edge) && !Map1862.across(id, edge)
            )
        expect(blocked(HarwichLocationId)).toEqual([1, 3, 4])
        expect(blocked(IpswichLocationId)).toEqual([0])
        expect(blocked('G12')).toEqual([1])
        expect(blocked('E14')).toEqual([4])
    })

    it('connects every off-board track to a land hex', () => {
        for (const location of locations.filter((candidate) => !candidate.buildable))
            for (const path of location.preprintedTile.paths)
                for (const end of path.endpoints)
                    if (end.kind === 'edge')
                        expect(Map1862.across(location.id, end.edge)?.location.buildable).toBe(true)
    })

    it('pays each area the printed figures for phases A–B, C–D and E–H', () => {
        const values = (area: (typeof OffboardAreaIds)[number]) =>
            OffboardStages.map((_, index) => {
                const stages = OffboardStages.slice(0, index + 1)
                return [
                    ...new Set(
                        offboardAreaLocationIds(area).flatMap((id) =>
                            Map1862.location(id)
                                .preprintedTile.nodes.filter((node) => node.id === area)
                                .map((node) =>
                                    node.kind === 'junction'
                                        ? 0
                                        : routeRevenue(node.revenue, stages)
                                )
                        )
                    )
                ]
            })
        expect(Object.fromEntries(OffboardAreaIds.map((area) => [area, values(area)]))).toEqual({
            midlands: [[40], [90], [140]],
            west: [[70], [100], [120]],
            london: [[100], [150], [200]],
            'north-lynn': [[80], [90], [100]],
            'north-wells': [[80], [90], [100]],
            'north-cromer': [[80], [90], [100]],
            'north-east': [[80], [100], [120]],
            east: [[60], [90], [120]],
            denmark: [[70], [100], [130]],
            holland: [[70], [100], [130]]
        })
    })

    it('groups the off-board hexes into their areas', () => {
        expect(offboardAreaLocationIds('midlands')).toEqual(['A2', 'A4', 'A6', 'A8'])
        expect(offboardAreaLocationIds('west')).toEqual(['A8', 'A10', 'A12'])
        expect(LondonLocationIds).toEqual(['A12', 'A14', 'B15', 'D15', 'C14'])
        expect(offboardAreaLocationIds('denmark')).toEqual(['H11', 'H13', 'G14'])
        expect(offboardAreaLocationIds('holland')).toEqual(['G14', 'F15'])
        expect(offboardArea('A8', 'west')).toBe('west')
        expect(offboardArea(LondonSpacesLocationId, LondonSpacesNodeId)).toBeUndefined()
        for (const area of OffboardAreaIds)
            for (const id of offboardAreaLocationIds(area))
                expect(Map1862.location(id).preprintedTile.color).toBe(
                    OffboardAreas[area].kind === 'red' ? 'red' : 'blue'
                )
    })

    it('lets a route include one red area and one port at most', () => {
        for (const id of RedOffboardLocationIds)
            expect(Map1862.location(id).preprintedTile.color).toBe('red')
        for (const id of PortLocationIds)
            expect(Map1862.location(id).preprintedTile.color).toBe('blue')
        expect(RedOffboardLocationIds.length + PortLocationIds.length + land.length).toBe(
            locations.length
        )
    })

    it('prints London’s four station spaces beside its off-board area, off every track', () => {
        const face = Map1862.location(LondonSpacesLocationId).preprintedTile
        const spaces = face.nodes.find((node) => node.id === LondonSpacesNodeId)
        expect(spaces).toEqual({
            id: LondonSpacesNodeId,
            kind: 'city',
            revenue: { kind: 'fixed', amount: 0 },
            stationSlots: LondonSpaceCount
        })
        expect(LondonSpaceCount).toBe(4)
        expect(
            face.paths.some((path) =>
                path.endpoints.some(
                    (end) => end.kind === 'node' && end.nodeId === LondonSpacesNodeId
                )
            )
        ).toBe(false)
    })
})
