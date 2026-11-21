import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createTrackTileFace as track,
    createCityTileFace as city,
    createSeparateCitiesTileFace as cities,
    createJunctionTileFace as junction,
    createOffboardTileFace as offboard,
    type MapLocation,
    type TileEdge,
    type TileInventory
} from '@tabletop/18xx'
import {
    BridgeCityIds,
    GreatNorthernBorderIds,
    MexicoLocationIds,
    ResourceKinds,
    ResourceLocationIds
} from './mapFeatures.js'
import {
    PhaseValueStages,
    RedAreas,
    phaseValuesRevenue,
    redAreaToken,
    type PhaseValues,
    type RedAreaAssignment,
    type RedAreaId
} from './redAreas.js'

const Names: Readonly<Record<string, string>> = {
    A15: 'Winnipeg',
    A27: 'Montreal',
    B2: 'Seattle',
    B8: 'Helena',
    B14: 'Fargo',
    C3: 'Portland',
    C17: 'Minneapolis',
    C23: 'Detroit',
    C25: 'Toronto',
    C29: 'Boston',
    D6: 'Boise',
    D14: 'Omaha',
    D20: 'Chicago',
    D24: 'Cleveland',
    D28: 'New York',
    E1: 'San Francisco',
    E3: 'Sacramento',
    E7: 'Salt Lake City',
    E11: 'Denver',
    E15: 'Kansas City',
    E17: 'St. Louis',
    E23: 'Columbus',
    F20: 'Louisville',
    F26: 'Baltimore',
    G3: 'Los Angeles',
    G7: 'Phoenix',
    G11: 'Santa Fe',
    G17: 'Memphis',
    G27: 'Norfolk',
    H8: 'Tucson',
    H14: 'Dallas-Fort Worth',
    H20: 'Birmingham',
    H22: 'Atlanta',
    I13: 'San Antonio',
    I15: 'Houston',
    I19: 'New Orleans',
    I25: 'Jacksonville',
    J20: 'Port of New Orleans',
    J24: 'Florida',
    ...Object.fromEntries(MexicoLocationIds.map((id) => [id, 'Mexico']))
}

type Markers = NonNullable<MapLocation['markers']>
const ResourceNames = { coal: 'Coal', oil: 'Oil', ore: 'Ore' } as const

function printedMarkers(): Readonly<Record<string, Markers>> {
    const markers: Record<string, Markers> = {}
    const add = (locationId: string, marker: Markers[number]) => {
        markers[locationId] = [...(markers[locationId] ?? []), marker]
    }
    for (const kind of ResourceKinds)
        for (const locationId of ResourceLocationIds[kind])
            add(locationId, {
                id: kind,
                label: ResourceNames[kind],
                description: `A ${kind} token may be placed here with a yellow tile.`
            })
    for (const locationId of BridgeCityIds)
        add(locationId, {
            id: 'bridge',
            label: 'Bridge',
            description: 'A bridge token may be placed in this city.'
        })
    for (const locationId of GreatNorthernBorderIds)
        add(locationId, {
            id: 'great-northern',
            label: 'Great Northern',
            description: 'P17 Great Northern Railway may lay its extra yellow track here.'
        })
    return markers
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 1,
    fixedColors: ['gray', 'red', 'blue'],
    names: Names,
    homes: {},
    markers: printedMarkers()
})

const mountain = { terrain: { cost: 15, kinds: ['mountain'] } }
const river = { terrain: { cost: 10, kinds: ['water'] } }
const lake = { terrain: { cost: 20, kinds: ['lake'] } }
const blank = track('white', [])
const plainCity = city('white', [], 0, 1)

const smallCity = (edges: readonly TileEdge[], values: PhaseValues) =>
    city('gray', edges, phaseValuesRevenue(values), 0)

// A red area's printed values are those of the token dealt onto it at setup (§2.6).
const Undealt = phaseValuesRevenue([0, 0, 0, 0])

/** The revenue each red area's token deals onto its hexes, for the tile inventory. */
export function dealtRedAreaRevenues(
    assignment: RedAreaAssignment
): NonNullable<TileInventory['dealtRevenues']> {
    return Object.fromEntries(
        RedAreas.flatMap((area) => Object.entries(redAreaRevenues(area.id, assignment[area.id])))
    )
}

/** The revenue a red-area token deals onto each of its area's hexes. */
export function redAreaRevenues(
    areaId: RedAreaId,
    tokenId: string
): NonNullable<TileInventory['dealtRevenues']> {
    const area = RedAreas.find((entry) => entry.id === areaId)
    const values = redAreaToken(tokenId).values
    return Object.fromEntries(
        (area?.locationIds ?? []).map((locationId) => [
            locationId,
            {
                kind: 'staged' as const,
                values: PhaseValueStages.map((stage, index) => ({ stage, amount: values[index] }))
            }
        ])
    )
}

export const EighteenUSAMap: RailwayMap = createMap()

function createMap(): RailwayMap {
    const redSmallCity = (edges: readonly TileEdge[]) => city('red', edges, Undealt, 0)
    const mexico = (edges: readonly TileEdge[]) => offboard(edges, Undealt)
    const mexicoGroup = { stopGroup: 'mexico' }
    return new RailwayMap({
        id: '18usa',
        name: '18USA',
        orientation: HexOrientation.Pointy,
        locations: [
            ...locations(
                'B20 B26 C5 C11 C13 C15 D2 D4 D12 D22 E13 E27 F2 F6 F12 F14 G9 G13 G19 G25 H10 H12 H16 H24 H26',
                blank
            ),
            ...locations('B10 B12 B16 B18 C19 D16 E5 E19 F16 G15 H4 H6 I17 I21 I23 J14', blank),
            ...locations(
                'B6 B28 C7 C9 C27 D8 D10 D26 E9 E25 F4 F8 F10 F22 F24 G5 G21 G23',
                blank,
                mountain
            ),
            ...locations('B4 D18 E21 F18 H18', blank, river),
            ...locations('B22', blank, lake),
            ...locations(
                'B8 B14 C29 D6 D20 E3 E7 E11 E23 F26 G3 G7 G11 G27 H8 H14 H20 H22 I13 I15 I25',
                plainCity
            ),
            ...locations('D24', plainCity, {
                upgradeLabels: [{ color: 'brown', label: 'CLE' }]
            }),
            ...locations('C3 C17 D14 E15 E17 F20 G17 I19', plainCity, river),
            ...locations('B30', track('gray', [[1, 0]])),
            ...locations('C23', smallCity([4, 2, 0], [30, 40, 50, 60])),
            ...locations('C25', smallCity([1, 5, 3], [20, 30, 40, 40])),
            ...locations(
                'D28',
                cities(
                    'yellow',
                    [
                        { edges: [0, 3], revenue: 40, stationSlots: 1 },
                        { edges: [1], revenue: 40, stationSlots: 1 }
                    ],
                    ['NY']
                )
            ),
            ...locations('F28', junction('blue', [0])),
            ...locations('B24 C21', track('blue', [])),
            ...locations('A15', redSmallCity([0, 5])),
            ...locations('A27', offboard([5, 0], Undealt)),
            ...locations('B2', redSmallCity([4, 5])),
            ...locations('E1', redSmallCity([4, 5, 3])),
            ...locations('J24', redSmallCity([2, 3])),
            ...locations('J20', offboard([2], Undealt)),
            ...locations('I5 I7 I9', mexico([2, 3]), mexicoGroup),
            ...locations('I11', mexico([2, 3, 4]), mexicoGroup),
            ...locations('J12', mexico([3, 4]), mexicoGroup),
            ...locations('K13', mexico([3]), mexicoGroup)
        ]
    })
}
