import {
    Map1849,
    PortBonus1849,
    PortLocationIds,
    PortMarkerKind,
    TileSet1849,
    TitleRules1849
} from '@tabletop/1849'
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
        depot: { x: 1850, y: 470, width: 340, height: 160 },
        // The corporations' start order stands in the sea south of Trapani and Marsala (§2.2).
        panel: { x: -40, y: 420, width: 340, height: 170 }
    },
    stations: Stations,
    borderWidths: { impassable: 5 },
    // Rough, hills and mountains (L. 40, 80 and 160) as one, two and three peaks (§10.3.1).
    terrainIcons: { rough: 'peak', hill: 'mountain', mountain: 'range' },
    // The terrain token goes back on each tile laid, its cost paid again on upgrade (§10.3.1).
    terrainKeptOnTiles: true,
    // K9's printed track runs through its centre, so its cost stands under its peaks beside it.
    terrainPositions: { K9: { x: -22, y: -5 } },
    terrainCostsBelow: ['K9'],
    layouts: {
        ...TileLayouts1849,
        ...PortLayouts,
        // Each grey city's three values stand in its clear side: west of Trapani and Marsala,
        // whose track leaves east and along the coast, and below Terranova's two spaces, its only
        // side without track, in a row with their phases above (§10.5.2).
        // Trapani's and Marsala's cities stand a little east, so their values clear them.
        C1: {
            nodePositions: { city: { x: 12, y: 0 } },
            revenuePositions: { city: { x: -26, y: 0 } }
        },
        E1: {
            nodePositions: { city: { x: 12, y: 0 } },
            revenuePositions: { city: { x: -26, y: 0 } }
        },
        M9: { revenuePositions: { city: { x: 0, y: 30 } }, revenueCaptionsAbove: true }
    },
    revenueStageColors: {
        low: [TrainColors1849['4H'], TrainColors1849['6H']],
        middle: [TrainColors1849['8H'], TrainColors1849['10H']],
        high: [TrainColors1849['12H'], TrainColors1849['16H']]
    },
    // Each value is paid from the phase named beside it (§10.5.2).
    revenueStageCaptions: { low: '4', middle: '8', high: '12' },
    locationMarkerNames: {
        'blocks-SCE': 'No track while a player owns the Società Corriere Etnee',
        [PortMarkerKind]: `+${TitleRules1849.currencySymbol}${PortBonus1849} port token`
    }
}
