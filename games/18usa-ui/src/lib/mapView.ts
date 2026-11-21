import {
    EighteenUSACorporations,
    EighteenUSAMap,
    EighteenUSATileSet,
    MexicoLocationIds,
    NewYorkId
} from '@tabletop/18usa'
import { TileEdges, type TileEdge } from '@tabletop/18xx'
import {
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'
import { EighteenUSALogos } from './logos.js'
import {
    EighteenUSAMarkerArt,
    EighteenUSAMarkerNames,
    eighteenUSAStateMarkers
} from './mapTokens.js'
import { EighteenUSAPhaseColors } from './trainPresentation.js'

const Stations: Readonly<Record<string, StationAppearance>> = Object.fromEntries(
    EighteenUSACorporations.map((company) => [
        company.id,
        {
            color: company.color,
            label: company.abbreviation,
            imageUrl: EighteenUSALogos[company.id]
        }
    ])
)

// Mexico is one red area of six hexes (§12.4.1): drawn joined, its name and values once.
const [MexicoLabelId, ...OtherMexicoIds] = ['I9', ...MexicoLocationIds.filter((id) => id !== 'I9')]
const insideMexico = (locationId: string) => (edge: TileEdge) => {
    const neighborId = EighteenUSAMap.neighbor(locationId, edge)?.id
    return !!neighborId && MexicoLocationIds.includes(neighborId)
}
const MexicoJoinedEdges = Object.fromEntries(
    MexicoLocationIds.map((locationId) => [locationId, TileEdges.filter(insideMexico(locationId))])
)

// New York's through city on the line from side 0 to side 3, the other city by its own track.
const NewYork = (secondCityEdge: number): TileLayout => ({
    nodePositions: {
        'city-0': towardTileEdge(secondCityEdge + 3, 12),
        'city-1': towardTileEdge(secondCityEdge, 22)
    }
})

export const EighteenUSAMapView: MapViewDefinition = {
    // Fitted at TOP's market scale, 12 map units clear of every hex: the market, wrapped onto two
    // lines, and the Bank of New York's loan strip beneath it run across Canada above the map and
    // the depot, which stands in the Pacific beside the west coast.
    boardAreas: {
        market: { x: -433, y: -406, width: 1740, height: 343 },
        depot: { x: -436, y: 40, width: 379, height: 520 }
    },
    map: EighteenUSAMap,
    tileSet: EighteenUSATileSet,
    stations: Stations,
    revenueStageColors: {
        yellow: EighteenUSAPhaseColors['2'],
        green: EighteenUSAPhaseColors['3'],
        brown: EighteenUSAPhaseColors['5'],
        gray: EighteenUSAPhaseColors['7']
    },
    offboardNames: { fontSize: 7.5, color: '#4a0b0b', wordSpacing: 0.2 },
    markerArt: EighteenUSAMarkerArt,
    locationMarkerNames: EighteenUSAMarkerNames,
    stateMarkers: eighteenUSAStateMarkers,
    joinedEdges: MexicoJoinedEdges,
    hideLocationNames: OtherMexicoIds,
    layouts: {
        ...Object.fromEntries(OtherMexicoIds.map((id) => [id, { hideRevenue: true }])),
        [NewYorkId]: NewYork(1),
        '18usa:X12': NewYork(1.5)
    },
    drawnLast: [MexicoLabelId]
}
