import ALogo from './images/logos/A.svg'
import BLogo from './images/logos/B.svg'
import CLogo from './images/logos/C.svg'
import CHILogo from './images/logos/CHI.svg'
import MCLogo from './images/logos/MC.svg'
import MEXLogo from './images/logos/MEX.svg'
import NdMLogo from './images/logos/NdM.svg'
import PACLogo from './images/logos/PAC.svg'
import SPMLogo from './images/logos/SPM.svg'
import TMLogo from './images/logos/TM.svg'
import UdYLogo from './images/logos/UdY.svg'
import type { TileEdge } from '@tabletop/18xx'
import {
    CopperCanyonLocationId,
    MapMex,
    MeridaLocationId,
    MexicoCityLabel,
    MexicoCityLocationId,
    PueblaLabel,
    PueblaLocationId,
    TileSetMex
} from '@tabletop/18mex'
import { towardTileEdge, type MapViewDefinition, type TileLayout } from '@tabletop/18xx-ui'
import { PhaseColorsMex } from './trainPresentation.js'

/** Company colours, as the charters print them. */
export const CompanyColorsMex: Readonly<Record<string, string>> = {
    CHI: '#d7282f',
    NdM: '#1f8a3b',
    MC: '#232b2b',
    PAC: '#f2d51d',
    TM: '#f08a24',
    MEX: '#8c8c8c',
    SPM: '#1f6fc4',
    UdY: '#7a2a7f',
    A: '#7cbf3a',
    B: '#0f5a2a',
    C: '#c0398a'
}

const Logos: Readonly<Record<string, string>> = {
    CHI: CHILogo,
    NdM: NdMLogo,
    MC: MCLogo,
    PAC: PACLogo,
    TM: TMLogo,
    MEX: MEXLogo,
    SPM: SPMLogo,
    UdY: UdYLogo,
    A: ALogo,
    B: BLogo,
    C: CLogo
}

const Centre = { x: 0, y: 0 }
/** A city in the middle with a town toward a side, as the board and tiles print them. */
const cityAndTown = (town: string, side: number): TileLayout => ({
    nodePositions: { city: Centre, [town]: towardTileEdge(side, 30) }
})
/** A seaport's value beside its town, toward the next side, which no port tile runs track to. */
const port = (side: number): TileLayout => ({
    ...cityAndTown('port', side),
    revenuePositions: { port: towardTileEdge(side + 0.6, 36) }
})
/**
 * Mexico City's label stands clear of its track: below the city while only its north and
 * south-east sides carry track, and in the south-west corner between its tracks on the brown.
 */
const toluca = (side: number, brown = false): TileLayout => ({
    ...cityAndTown('toluca', side),
    labelPosition: brown ? towardTileEdge(0.42, 36) : towardTileEdge(0.6, 30),
    ...(brown
        ? {
              revenuePositions: {
                  city: towardTileEdge(3.7, 33),
                  toluca: towardTileEdge(side + 0.5, 36)
              }
          }
        : {})
})

/** Where Copper Canyon's gentle curve, drawn as a cubic, heads in from its side. */
const CopperCanyonGentleEnter = towardTileEdge(4, 21)

/**
 * Where the stops of the hexes and tiles with several stand: the seaports at the ends of their
 * spurs, Toluca beside Mexico City, and Copper Canyon's town below where its tracks part.
 */
const Layouts: Readonly<Record<string, TileLayout>> = {
    // Mazatlán's label in its clear upper left, off its water cost.
    K6: { ...port(1), labelPosition: towardTileEdge(2.3, 26) },
    // San Antonio's values a little clear of its stations; Matamoros' below its eastern station.
    D11: { revenuePositions: { city: { x: 0, y: -25 } } },
    I12: { revenuePositions: { city: { x: 18, y: 28 } }, revenueStack: 'column' },
    // Mérida prints spikes, not track: a route may only begin or end there (4.4.2(h)).
    [MeridaLocationId]: {
        printedPaths: Object.fromEntries(
            MapMex.location(MeridaLocationId).preprintedTile.paths.map((path) => [
                path.id,
                'spike' as const
            ])
        )
    },
    M12: port(4),
    P13: port(5),
    [MexicoCityLocationId]: toluca(2),
    // Copper Canyon prints a straight, a gentle and a tight curve, its town on the run the
    // straight and the gentle share before they part.
    '18mex:470': {
        nodePositions: { town: towardTileEdge(0, 30), fork: towardTileEdge(0, 18) },
        pathControls: { 'edge-4': [CopperCanyonGentleEnter, { x: 0, y: -4 }] },
        labelPosition: towardTileEdge(1.6, 30)
    },
    '18mex:471': port(4.5),
    '18mex:472': port(4),
    '18mex:473': port(4),
    '18mex:476': port(0),
    '18mex:477': port(3.5),
    '18mex:478': port(0),
    '18mex:479MC': toluca(2.5),
    '18mex:482': port(0),
    '18mex:483': port(3.5),
    '18mex:484': port(0),
    '18mex:485MC': toluca(2, true),
    // The four stations turn so Toluca, the label and the value each stand in a gap between two.
    '18mex:486MC': {
        ...toluca(2, true),
        slotRowTurns: { city: 30 },
        nodePositions: { city: towardTileEdge(5, 5), toluca: towardTileEdge(2, 34) },
        revenuePositions: { city: { x: 17, y: -35 }, toluca: { x: -21, y: -34 } },
        labelPosition: towardTileEdge(0.58, 37)
    }
}

export const MapViewMex: MapViewDefinition = {
    map: MapMex,
    tileSet: TileSetMex,
    // Fitted at TOP's market scale to keep every market cell and the depot 12 map units clear of
    // every hex: the market right of the map, level with its top, its stepped lower edge in the
    // empty north-east; the depot in the empty south-west where the board prints the Initial
    // Offering.
    boardAreas: {
        market: { x: 957, y: -43.3, width: 942, height: 556 },
        depot: { x: 34, y: 489.7, width: 381, height: 187 }
    },
    stations: Object.fromEntries(
        Object.entries(CompanyColorsMex).map(([companyId, color]) => [
            companyId,
            { color, label: companyId, imageUrl: Logos[companyId] }
        ])
    ),
    // Red areas and the three gray cities print their values until and from the first 5-train.
    revenueStageColors: { yellow: PhaseColorsMex['2'], brown: PhaseColorsMex['5'] },
    terrainIcons: { hill: 'peak', mountain: 'mountain', desert: 'cactus', swamp: 'marsh' },
    layouts: Layouts,
    offboardNames: { fontSize: 9, color: '#4a0b0b' },
    // Red areas' names a little below the top of their hexes, Copper Canyon's large one lower.
    nameOffsets: {
        ...Object.fromEntries(
            MapMex.definition.locations.flatMap(({ id, preprintedTile: { nodes } }) =>
                nodes.length && nodes.every((node) => node.kind === 'offboard')
                    ? [[id, { x: 0, y: 5 }]]
                    : []
            )
        ),
        [CopperCanyonLocationId]: { x: 0, y: 10 }
    },
    nameLines: {
        A6: ['Ciudad Juárez', 'El Paso'],
        B3: ['Nogales', 'Tucson'],
        [CopperCanyonLocationId]: ['Copper', 'Canyon']
    },
    // Copper Canyon, the KCM&O's special hex, in large type.
    nameStyles: { [CopperCanyonLocationId]: { fontSize: 11, color: '#202c31' } },
    // Mexico City and Puebla are one double hex, its tiles one piece (4.4.1(g)).
    joinedEdges: { [MexicoCityLocationId]: [5], [PueblaLocationId]: [2] },
    tileGroups: [[MexicoCityLocationId, PueblaLocationId]],
    joinedTileEdges: Object.fromEntries(
        TileSetMex.definitions.flatMap((tile): [string, readonly TileEdge[]][] =>
            tile.face.labels.includes(MexicoCityLabel)
                ? [[tile.id, [5]]]
                : tile.face.labels.includes(PueblaLabel)
                  ? [[tile.id, [2]]]
                  : []
        )
    )
}
