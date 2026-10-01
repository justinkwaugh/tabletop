import { PrivateCatalog } from '@tabletop/18xx'
import { EighteenThirtyPhases } from './trains.js'

export const EighteenThirtyPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: 'SV',
                name: 'Schuylkill Valley',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: ['G15'], until: 'company-owned' },
                description: 'Blocks G15 while player-owned. Closes at phase 5.'
            },
            {
                id: 'CS',
                name: 'Champlain & St. Lawrence',
                faceValue: 40,
                revenue: 10,
                blocks: { locationIds: ['B20'], until: 'company-owned' },
                description:
                    'The owning company may lay tile 3, 4 or 58 on Burlington (B20) without a connection, besides its ordinary lay. Blocks B20 while player-owned. Closes at phase 5.'
            },
            {
                id: 'DH',
                name: 'Delaware & Hudson',
                faceValue: 70,
                revenue: 15,
                blocks: { locationIds: ['F16'], until: 'company-owned' },
                description:
                    'The owning company may lay tile 57 on Scranton (F16) as its tile lay, paying $120, then place a free station there without a connection. Blocks F16 while player-owned. Closes at phase 5.'
            },
            {
                id: 'MH',
                name: 'Mohawk & Hudson',
                faceValue: 110,
                revenue: 20,
                blocks: { locationIds: ['D18'], until: 'company-owned' },
                description:
                    'The owner may exchange it at any time for a 10% NYC share from the IPO or market. Blocks D18 while player-owned. Closes at phase 5.'
            },
            {
                id: 'CA',
                name: 'Camden & Amboy',
                faceValue: 160,
                revenue: 25,
                blocks: { locationIds: ['H18'], until: 'company-owned' },
                description:
                    'Its first buyer also receives a 10% PRR share. Blocks Philadelphia & Trenton (H18) while player-owned. Closes at phase 5.'
            },
            {
                id: 'BOP',
                name: 'Baltimore & Ohio',
                faceValue: 220,
                revenue: 30,
                blocks: { locationIds: ['I13', 'I15'], until: 'company-owned' },
                sale: 'never',
                description:
                    'Its first buyer also receives the B&O president’s certificate and sets its par. Closes when the B&O buys a train. Blocks I13 and Baltimore (I15) while player-owned. Cannot be sold to a company. Closes at phase 5.'
            }
        ]
    },
    EighteenThirtyPhases
)
export const EighteenThirtyPrivates = EighteenThirtyPrivateCatalog.privates
