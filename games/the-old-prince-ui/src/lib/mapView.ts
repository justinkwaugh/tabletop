import BoardImage from './images/MAP-AUGUST-01.jpg'
import VernonRiver from './images/vernon-river.svg'
import CToken from './images/tokens/C.svg'
import SoToken from './images/tokens/So.svg'
import AToken from './images/tokens/A.svg'
import MSToken from './images/tokens/MS.svg'
import MRToken from './images/tokens/MR.svg'
import SToken from './images/tokens/S.svg'
import GtToken from './images/tokens/Gt.svg'
import PEIRToken from './images/tokens/PEIR.svg'
import CBToken from './images/tokens/CB.svg'
import SBToken from './images/tokens/SB.svg'
import MBToken from './images/tokens/MB.svg'
import BBToken from './images/tokens/BB.svg'
import WBToken from './images/tokens/WB.svg'
import HRBToken from './images/tokens/HRB.svg'
import CPublished from './images/published/tokens/C.svg'
import SoPublished from './images/published/tokens/So.svg'
import APublished from './images/published/tokens/A.svg'
import MSPublished from './images/published/tokens/MS.svg'
import MRPublished from './images/published/tokens/MR.svg'
import SPublished from './images/published/tokens/S.svg'
import GtPublished from './images/published/tokens/Gt.svg'
import PEIRPublished from './images/published/tokens/PEIR.svg'
import CBPublished from './images/published/tokens/CB.svg'
import SBPublished from './images/published/tokens/SB.svg'
import MBPublished from './images/published/tokens/MB.svg'
import BBPublished from './images/published/tokens/BB.svg'
import WBPublished from './images/published/tokens/WB.svg'
import HRBPublished from './images/published/tokens/HRB.svg'
import { TheOldPrinceMap, TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import { TheOldPrincePublishedTileAppearance } from './tileAppearance.js'
import type { MapViewDefinition } from '@tabletop/18xx-ui'

export const TheOldPrinceMapView: MapViewDefinition = {
    boardArtwork: {
        backgroundColor: '#222a2c',
        imageUrl: BoardImage,
        width: 2048,
        height: 1322,
        origin: { x: 55.5, y: 105.5 },
        scale: 1.173
    },
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    markerImages: { 'vernon-river-bridge': VernonRiver },
    // Printed city circles that sit off the generic hex centre on the published board, measured in
    // map units (hex radius 50) from MAP-AUGUST-01.jpg; see docs/board-artwork.md.
    publishedTileAppearance: TheOldPrincePublishedTileAppearance,
    // The printed board rearranges three offboard groups. Each semantic hex is moved to its
    // printed cell (axial q = column index, r = (row - q - 1) / 2) and its track edges remapped
    // to the printed ones (edge 0 = S, 1 = SW, 2 = NW, 3 = N, 4 = NE, 5 = SE).
    publishedPlacements: {
        // England: printed G11 → H10 → I9 → J8; semantic G11 → H10 → G9 → H8 → H6.
        H10: { edges: { 2: 4 } },
        G9: { at: { q: 8, r: 0 }, edges: { 5: 1 } }, // printed I9
        H8: { hidden: true },
        H6: { at: { q: 9, r: -1 }, edges: { 0: 1 } }, // printed J8
        // Îles de la Madeleine: printed T14 → U15 → V14 → W15; semantic T14 → U15 → U17 → V16.
        U15: { edges: { 0: 4 } },
        U17: { at: { q: 21, r: -4 }, edges: { 3: 1, 4: 5 } }, // printed V14
        V16: { at: { q: 22, r: -4 }, edges: { 1: 2 } }, // printed W15
        // Pictou Landing: printed P22 → P24 → Q23 → R24; semantic P22 → P24 → O25 → P26.
        P24: { edges: { 1: 4 } },
        O25: { at: { q: 16, r: 3 }, edges: { 4: 1 } }, // printed Q23
        P26: { at: { q: 17, r: 3 } } // printed R24, entering at the same NW edge
    },
    publishedLayouts: {
        D14: { nodePositions: { city: { x: 9.9, y: -7.5 } } },
        F14: { nodePositions: { city: { x: -0.3, y: 11.3 } } },
        L16: { nodePositions: { city: { x: 0.7, y: 11.6 } } }
    },
    stations: {
        'branch:CB': { color: '#886bab', label: 'CB', imageUrl: CBToken },
        'branch:SB': { color: '#a44684', label: 'SB', imageUrl: SBToken },
        'branch:MB': { color: '#276d9c', label: 'MB', imageUrl: MBToken },
        'branch:BB': { color: '#b76a22', label: 'BB', imageUrl: BBToken },
        'branch:WB': { color: '#827c21', label: 'WB', imageUrl: WBToken },
        'branch:HRB': { color: '#33855b', label: 'HRB', imageUrl: HRBToken },
        C: { color: '#ad3539', label: 'C', imageUrl: CToken },
        ML: { color: '#ad3539', label: 'ML', imageUrl: CToken },
        So: { color: '#3b62a3', label: 'So', imageUrl: SoToken },
        PEIR: { color: '#333333', label: 'PEIR', imageUrl: PEIRToken },
        A: { color: '#795291', label: 'A', imageUrl: AToken },
        MS: { color: '#a56627', label: 'MS', imageUrl: MSToken },
        MR: { color: '#4b7b43', label: 'MR', imageUrl: MRToken },
        S: { color: '#286b73', label: 'S', imageUrl: SToken },
        Gt: { color: '#a14372', label: 'Gt', imageUrl: GtToken }
    },
    // Published presentation: the Boda Games charter tokens, coloured with the wood
    // specification's disc colours so route and market tints match the artwork.
    publishedStations: {
        'branch:CB': { color: '#618e92', label: 'CB', imageUrl: CBPublished },
        'branch:SB': { color: '#be7047', label: 'SB', imageUrl: SBPublished },
        'branch:MB': { color: '#7d6c6a', label: 'MB', imageUrl: MBPublished },
        'branch:BB': { color: '#8a8f55', label: 'BB', imageUrl: BBPublished },
        'branch:WB': { color: '#5969b1', label: 'WB', imageUrl: WBPublished },
        'branch:HRB': { color: '#7a5e74', label: 'HRB', imageUrl: HRBPublished },
        C: { color: '#ac483b', label: 'C', imageUrl: CPublished },
        ML: { color: '#ac483b', label: 'ML', imageUrl: CPublished },
        So: { color: '#b56e9a', label: 'So', imageUrl: SoPublished },
        PEIR: { color: '#353f47', label: 'PEIR', imageUrl: PEIRPublished },
        A: { color: '#7b69a5', label: 'A', imageUrl: APublished },
        MS: { color: '#cc9945', label: 'MS', imageUrl: MSPublished },
        MR: { color: '#908c89', label: 'MR', imageUrl: MRPublished },
        S: { color: '#607963', label: 'S', imageUrl: SPublished },
        Gt: { color: '#4d82ac', label: 'Gt', imageUrl: GtPublished }
    }
}
