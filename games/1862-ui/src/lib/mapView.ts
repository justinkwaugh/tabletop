import ECRLogo from './images/logos/ECR.svg'
import EHLogo from './images/logos/EH.svg'
import ENRLogo from './images/logos/ENR.svg'
import ESRLogo from './images/logos/ESR.svg'
import EURLogo from './images/logos/EUR.svg'
import FDRLogo from './images/logos/FDR.svg'
import IBLogo from './images/logos/IB.svg'
import LDLogo from './images/logos/LD.svg'
import LELogo from './images/logos/LE.svg'
import LHLogo from './images/logos/LH.svg'
import NBLogo from './images/logos/NB.svg'
import NELogo from './images/logos/NE.svg'
import NGCLogo from './images/logos/NGC.svg'
import NSLogo from './images/logos/NS.svg'
import SVRLogo from './images/logos/SVR.svg'
import WFLogo from './images/logos/WF.svg'
import WNRLogo from './images/logos/WNR.svg'
import WSTILogo from './images/logos/WSTI.svg'
import WVRLogo from './images/logos/WVR.svg'
import YNLogo from './images/logos/YN.svg'
import {
    Companies1862,
    LondonSpacesLocationId,
    LondonSpacesNodeId,
    Map1862,
    TileSet1862
} from '@tabletop/1862'
import { TileEdges, type MapLocation, type TileEdge } from '@tabletop/18xx'
import type { Point } from '@tabletop/common'
import {
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'

const Logos: Readonly<Record<string, string>> = {
    ECR: ECRLogo,
    EH: EHLogo,
    ENR: ENRLogo,
    ESR: ESRLogo,
    EUR: EURLogo,
    FDR: FDRLogo,
    IB: IBLogo,
    LD: LDLogo,
    LE: LELogo,
    LH: LHLogo,
    NB: NBLogo,
    NE: NELogo,
    NGC: NGCLogo,
    NS: NSLogo,
    SVR: SVRLogo,
    WF: WFLogo,
    WNR: WNRLogo,
    WSTI: WSTILogo,
    WVR: WVRLogo,
    YN: YNLogo
}

const Stations: Readonly<Record<string, StationAppearance>> = Object.fromEntries(
    Companies1862.map((company) => [
        company.id,
        { color: company.primaryColor, label: company.initials, imageUrl: Logos[company.id] }
    ])
)

const TowardEdge = 18
/** Each off-board area of a shared hex stands toward the edges its track leaves by. */
const areas = (positions: Readonly<Record<string, number>>): TileLayout => ({
    nodePositions: Object.fromEntries(
        Object.entries(positions).map(([area, edge]) => [area, towardTileEdge(edge, TowardEdge)])
    )
})

function offboardAreas(location: MapLocation): string[] {
    return location.preprintedTile.nodes
        .filter((node) => node.kind === 'offboard')
        .map((node) => node.id)
}

const OffboardLocationIds = Map1862.definition.locations
    .filter((location) => offboardAreas(location).length > 0)
    .map((location) => location.id)
// Each off-board area prints its name and values once across its joined hexes, in the hex given
// here: the name's baseline and the value stack's centre, set clear of the area's track. London
// prints both in the hex beside its station spaces, its values in a row.
const OffboardPrinting: Readonly<
    Record<string, { name?: Point; lines?: readonly string[]; stack?: Point }>
> = {
    A4: { name: { x: -4, y: -20 }, stack: { x: -14, y: 3.5 } },
    A10: { name: { x: -4, y: -20 }, lines: ['The West'], stack: { x: -14, y: 3.5 } },
    C2: { name: { x: 0, y: -28 }, lines: ['North', "King's Lynn"], stack: { x: -16, y: 11 } },
    D1: { name: { x: -2, y: -28 }, lines: ['North', 'Wells'], stack: { x: -14, y: 11 } },
    G2: { name: { x: 0, y: -24 }, lines: ['North', 'Cromer'], stack: { x: 0, y: 6 } },
    I4: { name: { x: 4, y: -24 }, lines: ['North East'], stack: { x: 14, y: 3.5 } },
    I8: { name: { x: 10, y: -24 }, stack: { x: 14, y: 6 } },
    H13: { name: { x: 8, y: -24 }, stack: { x: 14, y: 6 } },
    F15: { name: { x: 0, y: 34 }, stack: { x: -18, y: 2 } },
    B15: { name: { x: -2, y: -2 } }
}
const RedNameStyle = { fontSize: 10, color: '#4a0b0b', wordSpacing: 0.25 }
const PortNameStyle = { fontSize: 8.5, color: '#102a3a', wordSpacing: 0.25 }
const PortLocationIds = ['C2', 'D1', 'G2', 'I4', 'I8', 'H13', 'F15']

// A hex printed half in each of two areas; ``side`` holds the edges of the first area's half.
const SplitHexes: Readonly<
    Record<string, { areas: Readonly<Record<string, number>>; side: readonly TileEdge[] }>
> = {
    A8: { areas: { midlands: 4, west: 5 }, side: [2, 3, 4] },
    A12: { areas: { west: 4, london: 5 }, side: [2, 3, 4] },
    F1: { areas: { 'north-wells': 1, 'north-cromer': 0 }, side: [1, 2, 3] },
    I6: { areas: { 'north-east': 2, east: 1 }, side: [2, 3, 4] },
    G14: { areas: { denmark: 3, holland: 2 }, side: [3, 4, 5] }
}

const PrintedLayouts: Readonly<Record<string, TileLayout>> = {
    ...Object.fromEntries(
        Object.entries(SplitHexes).map(([id, split]) => [id, areas(split.areas)])
    ),
    // London's four station spaces sit below its track (§7.6.5), opening out into the London
    // hexes either side.
    [LondonSpacesLocationId]: {
        nodePositions: { london: towardTileEdge(3, 22), [LondonSpacesNodeId]: { x: 0, y: 22 } },
        slotSpreads: { [LondonSpacesNodeId]: 60 },
        hideRevenue: ['london', LondonSpacesNodeId]
    },
    // London's values print in a row, clear of the station space reaching in from C14.
    B15: { revenueStack: 'row', revenuePositions: { london: { x: 0, y: 10 } } },
    ...Object.fromEntries(
        Object.entries(OffboardPrinting).flatMap(([id, { stack }]) =>
            stack
                ? [[id, { revenuePositions: { [offboardAreas(Map1862.location(id))[0]]: stack } }]]
                : []
        )
    )
}

// London's values print in B15; every other off-board hex without a stack prints none.
const printsValues = (id: string) => id === 'B15' || !!OffboardPrinting[id]?.stack

const Layouts: Readonly<Record<string, TileLayout>> = {
    ...PrintedLayouts,
    ...Object.fromEntries(
        OffboardLocationIds.filter((id) => !printsValues(id)).map((id) => [
            id,
            { ...PrintedLayouts[id], hideRevenue: true }
        ])
    )
}

export const MapView1862: MapViewDefinition = {
    // The market's two zig-zag rows run above the map, far enough from Wells's top hex for the
    // depot to stand under its east end, in the corner between the Cromer and North East areas.
    boardAreas: {
        market: { x: -50, y: -231, width: 1052, height: 134 },
        depot: { x: 618, y: -85, width: 384, height: 202 },
        // The charter board stands east of the map, beside the East and Denmark areas, tall
        // enough for a third row of companies dealt at once with seven or eight players.
        panel: { x: 664, y: 236, width: 236, height: 262 }
    },
    map: Map1862,
    tileSet: TileSet1862,
    stations: Stations,
    layouts: Layouts,
    joinedEdges: Object.fromEntries(
        Map1862.definition.locations.map((location) => [
            location.id,
            TileEdges.filter((edge) => {
                const neighbor = Map1862.neighbor(location.id, edge)
                return (
                    !!neighbor &&
                    offboardAreas(location).some((area) => offboardAreas(neighbor).includes(area))
                )
            })
        ])
    ),
    splitHexes: Object.fromEntries(
        Object.entries(SplitHexes).map(([id, split]) => [id, split.side])
    ),
    hideLocationNames: OffboardLocationIds.filter((id) => !(id in OffboardPrinting)),
    offboardNames: RedNameStyle,
    nameStyles: Object.fromEntries(PortLocationIds.map((id) => [id, PortNameStyle])),
    namePositions: Object.fromEntries(
        Object.entries(OffboardPrinting).flatMap(([id, { name }]) => (name ? [[id, name]] : []))
    ),
    nameLines: Object.fromEntries(
        Object.entries(OffboardPrinting).flatMap(([id, { lines }]) => (lines ? [[id, lines]] : []))
    )
}
