import BHIRLogo from './images/logos/BHIR.svg'
import CNLogo from './images/logos/CN.svg'
import FYNLogo from './images/logos/FYN.svg'
import IOWLogo from './images/logos/IOW.svg'
import IWNJLogo from './images/logos/IWNJ.svg'
import NGStLLogo from './images/logos/NGStL.svg'
import SCLogo from './images/logos/SC.svg'
import VYSCLogo from './images/logos/VYSC.svg'
import {
    BhirId,
    CnId,
    CowesLocationId,
    FynId,
    IowId,
    IwnjId,
    Map1860,
    MerstoneLocationId,
    NgstlId,
    ScId,
    TileSet1860,
    VyscId,
    requireState1860
} from '@tabletop/1860'
import { isHalt } from '@tabletop/18xx'
import {
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'
import { CompanyNames1860 } from './companyPresentation.js'
import { PhaseColors1860 } from './trainPresentation.js'

/** Company colours, as the charters print them. */
export const CompanyColors1860: Readonly<Record<string, string>> = {
    [CnId]: '#00bfff',
    [IowId]: '#e2231a',
    [IwnjId]: '#1d1d1d',
    [FynId]: '#1f8a3b',
    [NgstlId]: '#f5d300',
    [BhirId]: '#8b008b',
    [ScId]: '#1a2a8c',
    [VyscId]: '#9acd32'
}

const Logos: Readonly<Record<string, string>> = {
    [CnId]: CNLogo,
    [IowId]: IOWLogo,
    [IwnjId]: IWNJLogo,
    [FynId]: FYNLogo,
    [NgstlId]: NGStLLogo,
    [BhirId]: BHIRLogo,
    [ScId]: SCLogo,
    [VyscId]: VYSCLogo
}

const initials = (companyId: string) => CompanyNames1860[companyId]?.initials ?? companyId

const Stations: Readonly<Record<string, StationAppearance>> = Object.fromEntries(
    Object.entries(CompanyColors1860).map(([companyId, color]) => [
        companyId,
        { color, label: initials(companyId), imageUrl: Logos[companyId] }
    ])
)

/** A bankrupt company's base, turned face down where it stands (Bankrupt Companies). */
const FaceDownBases: Readonly<Record<string, StationAppearance>> = Object.fromEntries(
    Object.keys(CompanyColors1860).map((companyId) => [
        companyId,
        { color: '#8f918c', label: initials(companyId) }
    ])
)

/** The halts print a £ for the subsidy they pay in place of a value (Track Tiles). */
// Halts print as grey stops with the £ of their subsidy (Track Tiles).
const Halt: TileLayout = { haltSymbol: '£', haltFill: '#a3a39b' }
const Centre = { x: 0, y: 0 }

/** Cowes: the large station to the north, the small station in the middle, the halt to the south. */
const Cowes: TileLayout = {
    ...Halt,
    nodePositions: { city: towardTileEdge(3, 25), town: Centre, halt: towardTileEdge(0, 25) },
    // Each value beside its own stop: the large station's and the small station's to the west,
    // clear of the halt's track from the south-west, and the halt's £ to the east.
    revenuePositions: { city: { x: -25, y: -22 }, town: { x: -21, y: 2 }, halt: { x: 20, y: 27 } },
    labelPosition: { x: 23, y: -20 }
}
/**
 * Newport drawn in from the north-west corner toward Shide, leaving the corner to Newport's
 * value; Shide's value to its east and the N in the south-west (#763, #773).
 */
const Newport: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(2.5, 12), 'city-1': towardTileEdge(5.5, 26) },
    revenuePositions: { 'city-0': towardTileEdge(2.5, 37), 'city-1': { x: 32, y: 6 } },
    labelPosition: { x: -18, y: 31 }
}
/**
 * The russet Newport's two spaces turned square to the line on to Shide, which runs out
 * between them (#773).
 */
const RussetNewport: TileLayout = { ...Newport, slotRowTurns: { 'city-0': -30 } }
/** Ventnor's two stations, each on its own line (#760, #774). */
const ventnor = (second: number): TileLayout => ({
    nodePositions: { 'city-0': towardTileEdge(4, 21), 'city-1': towardTileEdge(second, 23) }
})
/** Merstone in the middle, Blackwater on the line north to Newport (#761, #775). */
const merstone = (blackwater: string): TileLayout => ({
    ...Halt,
    nodePositions: { city: Centre, [blackwater]: towardTileEdge(3, 27) }
})
/** Two villages, the first by side 0 (#744, #745). */
const twoHalts = (side: number): TileLayout => ({
    ...Halt,
    nodePositions: { 'halt-0': towardTileEdge(0, 22), 'halt-1': towardTileEdge(side, 22) }
})
/** A halt by side 0 on its spur into the small station in the middle. */
const HaltAndStation: TileLayout = {
    ...Halt,
    nodePositions: { halt: towardTileEdge(0, 25), town: Centre }
}

const tile = (number: string) => `1860:${number}`

const TileLayouts: Readonly<Record<string, TileLayout>> = {
    // Single halts, and every other tile printing one, show its £.
    ...Object.fromEntries(
        TileSet1860.definitions
            .filter((definition) => definition.face.nodes.some(isHalt))
            .map((definition) => [definition.id, Halt])
    ),
    [tile('744')]: twoHalts(3),
    [tile('745')]: twoHalts(2),
    ...Object.fromEntries(
        ['754', '755', '782', '783', '784', '785'].map((number) => [tile(number), HaltAndStation])
    ),
    [tile('787')]: Cowes,
    [tile('788')]: Cowes,
    [tile('789')]: Cowes,
    [tile('763')]: Newport,
    [tile('773')]: RussetNewport,
    [tile('760')]: ventnor(0.5),
    [tile('774')]: ventnor(1),
    [tile('761')]: merstone('halt'),
    [tile('775')]: merstone('town')
}

const Layouts: Readonly<Record<string, TileLayout>> = {
    ...TileLayouts,
    // The printed Cowes: its large station north, small station south-west, halt south.
    [CowesLocationId]: {
        ...Halt,
        nodePositions: {
            city: towardTileEdge(3, 25),
            town: towardTileEdge(1, 25),
            halt: towardTileEdge(0, 25)
        }
    },
    [MerstoneLocationId]: merstone('halt'),
    // The two villages of a hex printed without track, side by side.
    H4: { nodePositions: { 'town-0': { x: -14, y: 4 }, 'town-1': { x: 14, y: 4 } } },
    I7: { nodePositions: { 'town-0': { x: -14, y: 4 }, 'town-1': { x: 14, y: 4 } } }
}

export const MapView1860: MapViewDefinition = {
    map: Map1860,
    tileSet: TileSet1860,
    // Fitted at TOP's market scale to keep every market cell and the depot 12 map units clear of
    // every hex: the zig-zag market across the sea north of the island, the depot in the empty
    // sea south of Totland and Calbourne.
    boardAreas: {
        market: { x: -41, y: -214, width: 908, height: 156 },
        depot: { x: -50, y: 362, width: 282, height: 206 },
        // The company layers stand in the sea off Sandown and Shanklin (Major Companies).
        panel: { x: 666, y: 362, width: 236, height: 196 }
    },
    stations: Stations,
    stateStations: (state) =>
        Object.fromEntries(
            requireState1860(state).bankruptIds.map((companyId) => [
                companyId,
                FaceDownBases[companyId]
            ])
        ),
    // Ryde Pier pays more as green and russet tiles arrive (The Map).
    revenueStageColors: {
        yellow: PhaseColors1860['2'],
        green: PhaseColors1860['3'],
        brown: PhaseColors1860['5']
    },
    terrainIcons: { hill: 'peak', marsh: 'marsh' },
    layouts: Layouts,
    nameLines: {
        H4: ['Wootton &', 'Havenstreet'],
        I7: ['Newchurch &', 'Alverstone'],
        I3: ['Ryde', 'Esplanade']
    }
}
