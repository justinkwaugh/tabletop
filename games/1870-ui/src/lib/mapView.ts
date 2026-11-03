import { assertExists } from '@tabletop/common'
import { Companies1870, Map1870, OffboardHomeLocationId, TileSet1870 } from '@tabletop/1870'
import { StandardTileLayouts, type MapViewDefinition, type TileLayout } from '@tabletop/18xx-ui'
import ATSFLogo from './images/logos/ATSF.svg'
import FWLogo from './images/logos/FW.svg'
import GMOLogo from './images/logos/GMO.svg'
import ICLogo from './images/logos/IC.svg'
import MKTLogo from './images/logos/MKT.svg'
import MPLogo from './images/logos/MP.svg'
import SLSFLogo from './images/logos/SLSF.svg'
import SPLogo from './images/logos/SP.svg'
import SSWLogo from './images/logos/SSW.svg'
import TPLogo from './images/logos/TP.svg'
import { RiverTerrainPositions, riverLines } from './river.js'
import { TrainColors1870 } from './trainPresentation.js'
import CattleToken from './images/tokens/cattle.svg'
import ClosedPortToken from './images/tokens/closed-port.svg'
import OpenPortToken from './images/tokens/open-port.svg'

export const TileLayouts1870: Readonly<Record<string, TileLayout>> = StandardTileLayouts

const Stations: MapViewDefinition['stations'] = {
    ATSF: { label: 'ATSF', color: '#7090c9', imageUrl: ATSFLogo },
    FW: { label: 'FW', color: '#56ad9a', imageUrl: FWLogo },
    GMO: { label: 'GMO', color: '#ff4080', imageUrl: GMOLogo },
    IC: { label: 'IC', color: '#b0b030', imageUrl: ICLogo },
    MP: { label: 'MP', color: '#5b4545', imageUrl: MPLogo },
    MKT: { label: 'MKT', color: '#018471', imageUrl: MKTLogo },
    SP: { label: 'SP', color: '#f48221', imageUrl: SPLogo },
    SSW: { label: 'SSW', color: '#111199', imageUrl: SSWLogo },
    SLSF: { label: 'SLSF', color: '#d02020', imageUrl: SLSFLogo },
    TP: { label: 'T&P', color: '#37383a', imageUrl: TPLogo }
}

function stationImage(companyId: string): string {
    const { imageUrl } = Stations[companyId]
    assertExists(imageUrl, 'Every 1870 company has a logo')
    return imageUrl
}

function destinationMark(label: string): string {
    const size = label.length > 3 ? 11 : 13
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18.5" fill="#fff" stroke="#111" stroke-width="3"/><text x="20" y="20" dy="0.35em" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="${size}" fill="#111">${label.replace('&', '&amp;')}</text></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const TokenKinds = {
    cattle: { name: 'Cattle', imageUrl: CattleToken },
    'open-port': { name: 'Open port', imageUrl: OpenPortToken },
    'closed-port': { name: 'Closed port', imageUrl: ClosedPortToken }
} as const

/**
 * The Southwest holds three companies' markers: the Southern Pacific's home and the Katy's
 * destination in the two corners between its spikes, the Santa Fe's below the lowest spike.
 */
const SouthwestHome: TileLayout = {
    revenueCaptionsAfter: true,
    printedTokens: [
        {
            imageUrl: SPLogo,
            // A printed token turns with the hex: this is 27 right and 18 up as drawn.
            at: { x: 14.4, y: -29.1 },
            radius: 11,
            title: 'The Southern Pacific starts here'
        }
    ]
}
const SouthwestMarkers: Readonly<Record<string, { x: number; y: number }>> = {
    MKT: { x: 27, y: 18 },
    ATSF: { x: -2, y: 33 }
}
const markerPlace = (companyId: string) => {
    const at = SouthwestMarkers[companyId]
    return at ? { at } : ('corner' as const)
}

export const MapView1870: MapViewDefinition = {
    map: Map1870,
    tileSet: TileSet1870,
    // At TOP's market scale the market sits east of the map, the depot in its lower-right
    // staircase, both clear of every hex.
    boardAreas: {
        market: { x: 1010, y: -40, width: 1314, height: 760 },
        depot: { x: 1920, y: 400, width: 381, height: 187 }
    },
    offboardNames: { fontSize: 11, color: '#4a0b0b' },
    // Low enough for the hex to be wide enough, and short where the name would not otherwise fit.
    namePositions: {
        A2: { x: 0, y: -27 },
        A22: { x: 0, y: -27 },
        N1: { x: -8, y: -27 },
        M22: { x: 8, y: -27 }
    },
    nameLines: { N1: ['SW'], M22: ['SE'] },
    stations: Stations,
    layouts: {
        ...TileLayouts1870,
        A2: { revenueCaptionsAfter: true },
        [OffboardHomeLocationId]: SouthwestHome
    },
    // Each value in the colours of the phases it pays in. Gray tiles come with the 6s, a phase before
    // the bottom value, so that one prints white with the train that brings it in, as the board does.
    revenueStageColors: {
        yellow: [TrainColors1870['2'], TrainColors1870['3']],
        brown: TrainColors1870['5'],
        gray: '#ffffff'
    },
    revenueStageCaptions: { gray: '8' },
    revenueStageCaptionColors: { gray: TrainColors1870['8'] },
    printedLines: riverLines(),
    terrainPositions: RiverTerrainPositions,
    locationMarkerNames: {
        port: 'On the Gulf or the river: the Gulf Shipping Company’s port may be placed here.',
        ...Object.fromEntries(
            Companies1870.flatMap((company) => [
                [`destination:${company.id}`, `${Stations[company.id].label} destination`],
                [`station:${company.id}`, `${Stations[company.id].label} destination station`],
                ...Object.entries(TokenKinds).map(([kind, token]) => [
                    `${company.id}:${kind}`,
                    `${Stations[company.id].label} ${token.name}`
                ])
            ])
        )
    },
    markerArt: {
        port: { revenueSymbol: 'port' },
        ...Object.fromEntries(
            Companies1870.flatMap((company) => [
                [
                    `destination:${company.id}`,
                    {
                        token: {
                            imageUrl: destinationMark(Stations[company.id].label),
                            place: markerPlace(company.id)
                        }
                    }
                ],
                [
                    `station:${company.id}`,
                    {
                        token: {
                            imageUrl: stationImage(company.id),
                            place: markerPlace(company.id)
                        }
                    }
                ],
                ...Object.entries(TokenKinds).map(([kind, token]) => [
                    `${company.id}:${kind}`,
                    { token: { imageUrl: token.imageUrl, place: { covers: 'port' as const } } }
                ])
            ])
        )
    }
}
