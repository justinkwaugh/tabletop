import { RailroadId } from '@tabletop/texas-special'
import type { BoardLayoutSpec } from '../boardLayout.js'

export const FRONTIER_LAYOUT: BoardLayoutSpec = {
    width: 1584,
    top: 128,
    bottom: 1110,
    legend: { x: 1326, y: 760 },
    finalPayoff: { x: 1252, y: 950 },
    logo: { x: 1092, y: 214 },
    title: 'Frontier Railroads',
    credit: '',
    metroGrids: {
        center: { columns: 3, origin: { x: 624.5, y: 685.5 } },
        junction: { columns: 2, origin: { x: 1245, y: 465 } }
    },
    baseNames: [
        { x: 1485, y: 326, railroadId: RailroadId.Red },
        { x: 1445.5, y: 680.5, railroadId: RailroadId.Blue },
        { x: 1307, y: 178, railroadId: RailroadId.Green },
        { x: 717.5, y: 167.5, railroadId: RailroadId.Brown },
        { x: 153, y: 236.5, railroadId: RailroadId.Black }
    ],
    namedSettlements: ['center', 'junction'],
    printedLabels: {},
    regions: []
}
