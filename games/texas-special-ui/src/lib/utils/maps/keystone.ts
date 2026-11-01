import { RailroadId } from '@tabletop/texas-special'
import type { BoardLayoutSpec } from '../boardLayout.js'

export const KEYSTONE_LAYOUT: BoardLayoutSpec = {
    width: 1740,
    top: 100,
    bottom: 1140,
    legend: { x: 42, y: 122 },
    finalPayoff: { x: 40, y: 300 },
    logo: { x: 1490, y: 925 },
    title: 'Keystone Railroads',
    credit: '',
    automaticDevelopment: { x: 1460, y: 960 },
    rulesReminder: {
        x: 400,
        y: 115,
        width: 635,
        notes: [
            [
                'Five metro areas, each paying $3–6 as it develops, take the place of The Center and The Junction;',
                'natural resources ($1, developed $5) replace the agricultural railheads.'
            ],
            [
                'The free metro area moves on as each fills, in the numbered order: it develops free, needs',
                'no track, and develops when a second development is declined.'
            ],
            [
                'The Yellow’s home is The Keystone: it opens once track reaches it, and a double link',
                'may not run into and out of it.'
            ],
            [
                'Crossings cost $30 and pay a special dividend, but add nothing to a railroad’s value.'
            ],
            ['The opening auction runs Brown, Blue, Black, Green, Red; the Red buyer goes first.']
        ]
    },
    metroGrids: {
        crossroads: { columns: 2, origin: { x: 251, y: 595 } },
        landing: { columns: 2, origin: { x: 37, y: 927 } },
        works: { columns: 2, origin: { x: 606, y: 541 } },
        bend: { columns: 2, origin: { x: 488, y: 884 } },
        keystone: { columns: 2, origin: { x: 853, y: 736 } }
    },
    baseNames: [
        { x: 1111, y: 1103, railroadId: RailroadId.Brown },
        { x: 1199, y: 887, railroadId: RailroadId.Blue },
        { x: 1373, y: 772, railroadId: RailroadId.Black },
        { x: 1592, y: 569, railroadId: RailroadId.Green },
        { x: 1298, y: 836, railroadId: RailroadId.Red }
    ],
    namedSettlements: ['keystone', 'bend', 'landing', 'works', 'crossroads'],
    printedLabels: {},
    regions: []
}
