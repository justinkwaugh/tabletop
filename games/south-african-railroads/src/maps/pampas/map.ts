import { Color } from '@tabletop/common'
import { ActionBox } from '../../model/actionBoxes.js'
import { MapId, RailroadId, SettlementKind, type MapDefinition } from '../types.js'
import { EXTERNAL_CONNECTIONS, LINKS, SETTLEMENTS } from './data.js'

// Pampas Railroads, John Bohrer's Argentine map. Positions follow Fabian Peng Kärrholm's 2023
// redraw, shifted left past its income track. Every opening railroad starts in Buenos Aires, on
// one of the links the board marks in its colour.
export const PAMPAS: MapDefinition = {
    id: MapId.Pampas,
    name: 'Pampas Railroads',
    railroads: [
        {
            id: RailroadId.BAGS,
            shortName: 'BAGS',
            name: 'Buenos Aires Great Southern Railway',
            color: Color.Yellow,
            homeId: 'buenos-aires',
            firstLinkIds: ['buenos-aires~las-flores', 'buenos-aires~maipu']
        },
        {
            id: RailroadId.NA,
            shortName: 'NA',
            name: 'North Argentine Railway',
            color: Color.Blue,
            homeId: 'buenos-aires',
            firstLinkIds: ['buenos-aires~san-nicolas']
        },
        {
            id: RailroadId.BAP,
            shortName: 'BA&P',
            name: 'Buenos Aires & Pacific Railway',
            color: Color.Black,
            homeId: 'buenos-aires',
            firstLinkIds: ['buenos-aires~pergamino', 'buenos-aires~mercedes']
        },
        {
            id: RailroadId.BAW,
            shortName: 'BAW',
            name: 'Buenos Aires Western Railway',
            color: Color.Red,
            homeId: 'buenos-aires',
            firstLinkIds: ['buenos-aires~pergamino', 'buenos-aires~mercedes', 'buenos-aires~lobos']
        },
        {
            id: RailroadId.CA,
            shortName: 'CA',
            name: 'Central Argentine Railway',
            color: Color.Green,
            homeId: 'buenos-aires',
            firstLinkIds: [
                'buenos-aires~pergamino',
                'buenos-aires~mercedes',
                'buenos-aires~lobos',
                'buenos-aires~las-flores',
                'buenos-aires~maipu',
                'buenos-aires~la-plata'
            ]
        },
        {
            id: RailroadId.CR,
            shortName: 'C&R',
            name: 'Córdoba & Rosario Railway',
            color: Color.Brown,
            homeId: 'cordoba',
            firstLinkIds: ['cordoba~cruz-del-eje', 'cordoba~dean-funes']
        }
    ],
    initialOffering: [
        RailroadId.BAGS,
        RailroadId.NA,
        RailroadId.BAP,
        RailroadId.BAW,
        RailroadId.CA
    ],
    startPlayerRailroad: RailroadId.CA,
    freeMetroDevelopment: false,
    automaticDevelopment: [],
    leaveTown: false,
    settlements: SETTLEMENTS,
    links: LINKS,
    externalConnections: EXTERNAL_CONNECTIONS,
    settlementIncome: {
        [SettlementKind.Town]: [1, 2],
        [SettlementKind.City]: [2, 3],
        [SettlementKind.Mine]: [1, 5],
        [SettlementKind.Port]: [2, 4]
    },
    metroIncome: {
        tucuman: [1, 2, 3, 4],
        cordoba: [2, 3, 4, 5, 6, 7],
        rosario: [2, 3, 4, 5],
        'buenos-aires': [5, 6, 7, 8]
    },
    startingCash: { 3: 80, 4: 70, 5: 60, 6: 50 },
    actionTrack: {
        kind: 'rows',
        rows: {
            [ActionBox.ConstructTrack]: 5,
            [ActionBox.DevelopSettlements]: 4,
            [ActionBox.OfferStock]: 3
        }
    },
    largestShareholderBuilds: true,
    metroOrder: { highest: 'buenos-aires', lowest: 'tucuman' },
    breakTiesBySharesOfMostValuable: true,
    // Nine rounds: eight dividends, then the big payoff.
    dividendsBeforeFinal: 8,
    specialDividendsRoundUp: true
}
