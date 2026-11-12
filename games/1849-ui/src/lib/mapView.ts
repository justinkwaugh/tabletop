import { Map1849, PortLocationIds, TileSet1849 } from '@tabletop/1849'
import { StandardTileLayouts, type MapViewDefinition, type TileLayout } from '@tabletop/18xx-ui'
import AFGLogo from './images/logos/AFG.svg'
import ATALogo from './images/logos/ATA.svg'
import CTLLogo from './images/logos/CTL.svg'
import IFTLogo from './images/logos/IFT.svg'
import RCSLogo from './images/logos/RCS.svg'
import SFALogo from './images/logos/SFA.svg'
import { CompanyColors1849 } from './companyPresentation.js'
import { TrainColors1849 } from './trainPresentation.js'

export const TileLayouts1849: Readonly<Record<string, TileLayout>> = { ...StandardTileLayouts }

const Stations: MapViewDefinition['stations'] = {
    AFG: { label: 'AFG', color: CompanyColors1849.AFG, imageUrl: AFGLogo },
    ATA: { label: 'ATA', color: CompanyColors1849.ATA, imageUrl: ATALogo },
    CTL: { label: 'CTL', color: CompanyColors1849.CTL, imageUrl: CTLLogo },
    IFT: { label: 'IFT', color: CompanyColors1849.IFT, imageUrl: IFTLogo },
    RCS: { label: 'RCS', color: CompanyColors1849.RCS, imageUrl: RCSLogo },
    SFA: { label: 'SFA', color: CompanyColors1849.SFA, imageUrl: SFALogo }
}

// Each port's track ends in an anchor at the coast (§4, §10.1).
const PortLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    PortLocationIds.map((locationId) => [locationId, { printedPaths: { 'path-0': 'pier' } }])
)

export const MapView1849: MapViewDefinition = {
    map: Map1849,
    tileSet: TileSet1849,
    boardAreas: {
        // East of the island, the depot in the market's empty lower right.
        market: { x: 1190, y: -60, width: 1004, height: 692 },
        depot: { x: 1850, y: 470, width: 340, height: 160 }
    },
    stations: Stations,
    layouts: { ...TileLayouts1849, ...PortLayouts },
    revenueStageColors: {
        low: [TrainColors1849['4H'], TrainColors1849['6H']],
        middle: [TrainColors1849['8H'], TrainColors1849['10H']],
        high: [TrainColors1849['12H'], TrainColors1849['16H']]
    },
    revenueStageCaptions: { low: '4–6', middle: '8–10', high: '12+' },
    locationMarkerNames: {
        'blocks-SCE': 'No track while a player owns the Società Corriere Etnee',
        port: '+L. 20 port token'
    }
}
