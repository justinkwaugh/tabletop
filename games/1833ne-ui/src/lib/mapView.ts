import { calculateHexGeometry, HexOrientation, type Point } from '@tabletop/common'
import { FerryArt } from './ferryArt.js'
import AStLToken from './images/tokens/AStL.png'
import BLToken from './images/tokens/BL.png'
import BMToken from './images/tokens/BM.png'
import BPToken from './images/tokens/BP.png'
import BWToken from './images/tokens/BW.png'
import CVToken from './images/tokens/CV.png'
import DHToken from './images/tokens/DH.png'
import EraToken from './images/tokens/Era.png'
import FRRToken from './images/tokens/FRR.png'
import HRToken from './images/tokens/HR.png'
import JointToken from './images/tokens/joint.png'
import LSLToken from './images/tokens/LSL.png'
import NYNHHToken from './images/tokens/NYNHH.png'
import RRToken from './images/tokens/RR.png'
import UPToken from './images/tokens/UP.png'
import StLAToken from './images/tokens/StLA.png'
import {
    JointTokenSource,
    Map1833NE,
    Phases1833NE,
    Places,
    TileSet1833NE,
    ValuePeriods,
    bonusArrow,
    valuePeriod
} from '@tabletop/1833ne'
import {
    StandardTileLayouts,
    TileRadius,
    towardTileEdge,
    type MapBonusArrow,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import { PhaseColors1833NE } from './trainPresentation.js'

// Boston's and Portland's terminals print spikes running all the way in to them.
const TerminalSpikeReach = 1

// A tile whose stops all pay alike prints its value once, as the board does.
const Boston: TileLayout = {
    spikeReach: TerminalSpikeReach,
    hideRevenue: ['city-0', 'city-1'],
    revenuePositions: { terminal: { x: 22, y: 24 } },
    labelPosition: { x: 32, y: 0 },
    nodePositions: {
        'city-0': towardTileEdge(1, 20),
        'city-1': towardTileEdge(3, 20),
        terminal: towardTileEdge(0, 26)
    }
}
const Montreal: TileLayout = {
    hideRevenue: ['city-1'],
    nodePositions: { 'city-0': towardTileEdge(5, 20), 'city-1': towardTileEdge(2, 20) }
}
const Portland: TileLayout = {
    spikeReach: TerminalSpikeReach,
    hideRevenue: ['terminal-0', 'terminal-1'],
    revenuePositions: { 'city-0': { x: -34, y: 0 } },
    nodePositions: {
        // The city sits low, toward the south-east, as printed.
        'city-0': towardTileEdge(5.3, 24),
        'terminal-0': towardTileEdge(1, 26),
        'terminal-1': towardTileEdge(2, 26)
    }
}

// Tokens the tiles print (p. 21): the D&H's mark on Westport's track to A12, the St. Lawrence
// corporations' joint token in Sherbrooke, and the B&P's reserved space in Boston's green tile.
const DelawareHudsonMark = {
    imageUrl: DHToken,
    at: towardTileEdge(1, 29),
    radius: 8.5,
    title: 'Delaware & Hudson RR: its corporation lays track and runs from A12'
}
const JointSpace = {
    imageUrl: JointToken,
    nodeId: 'city',
    slot: 0,
    title: 'The St. Lawrence corporations’ joint token'
}
const Westport: TileLayout = { printedTokens: [DelawareHudsonMark] }

/** Tile layouts are given before the tile's rotation, toward each stop's own track. */
export const TileLayouts1833NE: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1833ne:N11': { printedTokens: [JointSpace] },
    '1833ne:N21': { printedTokens: [JointSpace] },
    '1833ne:N26': Westport,
    '1833ne:N23': {
        spikeReach: TerminalSpikeReach,
        printedTokens: [
            {
                imageUrl: BPToken,
                nodeId: 'city-0',
                slot: 1,
                title: 'Reserved for the B&P until phase IV'
            }
        ],
        hideRevenue: ['city-0', 'city-1'],
        revenuePositions: { terminal: towardTileEdge(1.58, 30) },
        nodePositions: {
            'city-0': towardTileEdge(0, 18),
            'city-1': towardTileEdge(3.5, 20),
            terminal: towardTileEdge(2, 26)
        }
    },
    '1833ne:N24': {
        spikeReach: TerminalSpikeReach,
        hideRevenue: ['city-0', 'city-1'],
        nodePositions: {
            'city-0': towardTileEdge(1, 20),
            'city-1': towardTileEdge(3, 20),
            terminal: towardTileEdge(2, 26)
        }
    },
    '1833ne:N25': {
        hideRevenue: ['city-1'],
        nodePositions: { 'city-0': towardTileEdge(5.5, 18), 'city-1': towardTileEdge(4, 20) }
    }
}

/**
 * Where each offboard prints its name, on one line, and the stack of its values beneath, beside
 * its spikes as the printed board has them. Eastern Townships prints one name across its two
 * hexes and one stack. The east edge prints its phases after the values.
 */
const OffboardPrinting: Readonly<
    Record<string, { name?: Point; stack?: Point; captionsAfter?: true }>
> = {
    A6: { name: { x: 0, y: -20 }, stack: { x: -14, y: 3.5 } },
    A12: { name: { x: -4, y: -20 }, stack: { x: -14, y: 3.5 } },
    A20: { name: { x: -6, y: -20 }, stack: { x: -14, y: 3.5 } },
    A24: { name: { x: 0, y: -20 }, stack: { x: -14, y: 3.5 } },
    A28: { name: { x: -4, y: -20 }, stack: { x: -14, y: 3.5 } },
    B17: { name: { x: -18, y: -24 }, stack: { x: -23, y: 0 } },
    F1: { name: { x: 45, y: 12 } },
    G2: { stack: { x: -4, y: -6 }, captionsAfter: true },
    J11: { name: { x: 10, y: -20 }, stack: { x: 8, y: 6 }, captionsAfter: true }
}

/** A point beside the board by column (A = 0) and row number, as the printed map numbers them. */
function besideBoard(column: number, row: number) {
    return calculateHexGeometry(
        { orientation: HexOrientation.Flat, dimensions: { radius: TileRadius } },
        { q: column, r: (row - column) / 2 }
    ).center
}

/** A printed bonus arrow beside the board, its values those the rules pay for it. */
function arrow(
    id: string,
    [column, row]: readonly [number, number],
    heading: string,
    footer: MapBonusArrow['footer'],
    points: MapBonusArrow['points'],
    alsoPrints: readonly string[] = []
): MapBonusArrow {
    const { values } = bonusArrow(id)
    return {
        ...(alsoPrints.length ? { arrowIds: [id, ...alsoPrints] } : {}),
        id,
        center: besideBoard(column, row),
        heading,
        footer,
        values: ValuePeriods.flatMap((period) => {
            const amount = values[period.id]
            return amount === undefined ? [] : [{ label: period.id, amount, stage: period.stage }]
        }),
        points
    }
}

/**
 * The board's route bonus arrows where the printed map has them: one point for an
 * interconnection from its heading's place, two for a direct connection (p. 24).
 */
export const BonusArrows1833NE: readonly MapBonusArrow[] = [
    arrow('montreal-to-portland', [-0.55, 1.9], 'MONTREAL', 'to PORTLAND', 'right'),
    arrow('montreal-to-boston', [-0.55, 4], 'MONTREAL', 'to BOSTON', 'right'),
    arrow('ogdensburg-to-boston', [-0.55, 7.95], 'OGDENSBURG RR', 'to BOSTON', 'right'),
    arrow('albany-troy-to-boston', [-0.5, 18], 'ALBANY/TROY', 'to BOSTON', 'right'),
    arrow('boston-and-new-york', [-0.6, 26.1], 'BOSTON and', 'NEW YORK', 'both'),
    // One arrow prints Boston's interconnection to Montreal and to Ogdensburg, which are equal.
    arrow('boston-to-montreal', [8.6, 21.5], 'BOSTON to', 'MONTREAL or OGDENSBURG', 'left', [
        'boston-to-ogdensburg'
    ]),
    arrow('boston-and-north', [10.45, 21.5], 'BOSTON and', 'MONTREAL or OGDENSBURG', 'both'),
    arrow('boston-and-albany-troy', [10.45, 23.5], 'BOSTON and', 'ALBANY/TROY', 'both'),
    arrow('portland-to-montreal', [9.55, 13.1], 'PORTLAND', 'to MONTREAL', 'left'),
    arrow(
        'montreal-port-city',
        [6.1, 29.2],
        'MONTREAL',
        { before: 'to', symbol: 'port', after: 'CITY', spoken: 'ending at New Haven or Norwich' },
        'both'
    )
]

export const MapView1833NE: MapViewDefinition = {
    boardAreas: {
        market: { x: -115, y: -175, width: 1000, height: 150 },
        depot: { x: 545, y: 20, width: 470, height: 231 }
    },
    map: Map1833NE,
    tileSet: TileSet1833NE,
    bonusArrows: BonusArrows1833NE,
    layouts: {
        ...TileLayouts1833NE,
        G22: Boston,
        B3: Montreal,
        I14: Portland,
        ...Object.fromEntries(
            Object.entries(OffboardPrinting).map(([id, { stack, captionsAfter }]) => [
                id,
                stack
                    ? {
                          revenuePositions: { offboard: stack },
                          ...(captionsAfter ? { revenueCaptionsAfter: true } : {})
                      }
                    : { hideRevenue: true as const }
            ])
        ),
        // The port connections below New Haven and Norwich pay nothing and print an anchor.
        C28: { hideRevenue: true, printedPaths: { 'edge-3': 'pier' } },
        E28: { hideRevenue: true, printedPaths: { 'edge-3': 'pier' } },
        // Cape Cod's tip prints a spike out of Hyannis, not track.
        J25: { printedPaths: { 'edge-1': 'spike' } },
        F25: { labelPosition: { x: -22, y: 22 }, revenuePositions: { city: { x: -33, y: 0 } } },
        B11: Westport,
        H25: { nodePositions: { 'city-0': towardTileEdge(3, 20), 'city-1': towardTileEdge(0, 14) } }
    },
    cityNames: {
        H25: { 'city-0': 'Plymouth', 'city-1': 'New Bedford' }
    },
    // Each ferry's marker sits in its hex, as the board prints them (setup, p. 3).
    locationMarkerArt: Object.fromEntries(
        Object.entries(FerryArt).map(([id, imageUrl]) => [
            id,
            { ferry: { token: { imageUrl, place: 'corner' as const } } }
        ])
    ),
    // The connection bonuses name these places, so the board prints them large (p. 24).
    offboardNames: { fontSize: 9, color: '#4a0b0b' },
    // Eastern Townships is one printed area across its two hexes.
    joinedEdges: { F1: [5], G2: [2] },
    namePositions: Object.fromEntries(
        Object.entries(OffboardPrinting).flatMap(([id, { name }]) => (name ? [[id, name]] : []))
    ),
    labelsReplaceNames: true,
    borderWidths: { impassable: 5 },
    // Providence prints its river cost at the top and its label low, clear of its track.
    terrainPositions: { F25: { x: 0, y: -28 } },
    hideLocationNames: Object.keys(OffboardPrinting).filter((id) => !OffboardPrinting[id].name),
    nameLines: Object.fromEntries(
        Object.keys(OffboardPrinting).flatMap((id) => {
            const name = Map1833NE.location(id).name
            return name ? [[id, [name]]] : []
        })
    ),
    revenueStack: 'column',
    revenueStageCaptions: Object.fromEntries(
        ValuePeriods.map((period) => [period.stage, period.id])
    ),
    // A value for two phases is printed in both their colours.
    revenueStageColors: Object.fromEntries(
        ValuePeriods.map((period) => {
            const colors = Phases1833NE.phases
                .filter((phase) => valuePeriod(phase.id) === period.id)
                .map((phase) => PhaseColors1833NE[phase.id])
            return [period.stage, colors.length === 1 ? colors[0] : colors]
        })
    ),
    markerArt: {
        ...Object.fromEntries(
            ['P1', 'P2', 'P3'].map((id) => [`blocks-${id}`, { localLine: true, above: true }])
        ),
        // Only the B&W, or the B&P, may build here in the first operating round (§6.46).
        'first-round': { notice: true },
        'terrain-discount': { terrainNote: true }
    },
    // The corporations' tokens, from GMT's sample token sheet.
    stations: {
        'B&W': { color: '#ffffff', label: 'B&W', imageUrl: BWToken },
        'B&P': { color: '#eacd93', label: 'B&P', imageUrl: BPToken },
        'B&L': { color: '#f5abad', label: 'B&L', imageUrl: BLToken },
        FRR: { color: '#d1e088', label: 'Fitch', imageUrl: FRRToken },
        HR: { color: '#c4e9fb', label: 'Hart', imageUrl: HRToken },
        RR: { color: '#2f7146', label: 'Rut', imageUrl: RRToken },
        CV: { color: '#0095da', label: 'CV', imageUrl: CVToken },
        'StL&A': { color: '#f38221', label: 'StL&A', imageUrl: StLAToken },
        'A&StL': { color: '#8d807d', label: 'A&StL', imageUrl: AStLToken },
        'B&M': { color: '#76090f', label: 'B&M', imageUrl: BMToken },
        'NYNH&H': { color: '#33ee33', label: 'NH', imageUrl: NYNHHToken },
        Era: { color: '#a2633f', label: 'Era', imageUrl: EraToken },
        UP: { color: '#ff0000', label: 'UP', imageUrl: UPToken },
        LSL: { color: '#6a6afa', label: 'LSL', imageUrl: LSLToken }
    },
    // The St. Lawrence corporations' one Sherbrooke token prints both their marks (§6.53).
    sharedStations: {
        [JointTokenSource]: { color: '#8d807d', label: 'StL&A / A&StL', imageUrl: JointToken }
    },
    // The board prints it in Sherbrooke, where it goes with the city's yellow tile.
    printedReservations: [
        { locationId: Places.sherbrooke, nodeId: 'city', companyId: JointTokenSource }
    ]
}
