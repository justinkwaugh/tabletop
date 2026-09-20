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
import { TheOldPrinceMap, TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import type { MapViewDefinition } from '@tabletop/18xx-ui'

export const TheOldPrinceMapView: MapViewDefinition = {
    boardArtwork: {
        backgroundColor: '#222a2c',
        imageUrl: BoardImage,
        width: 2048,
        height: 1394,
        origin: { x: 128, y: 169 },
        scale: 1.067
    },
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    markerImages: { 'vernon-river-bridge': VernonRiver },
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
    }
}
