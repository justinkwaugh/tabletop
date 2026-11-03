import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import { Phases1870 } from './trains.js'

export const GreatRiverPrivateId = 'GRSC'
export const BridgePrivateId = 'MRBC'
export const CattlePrivateId = 'SCC'
export const PortPrivateId = 'GSC'
export const FriscoPrivateId = 'FRISCO'
export const KatyPrivateId = 'KATY'

// The six private companies, offered in this order (p. 2, pp. 8-10). All close with phase 4.
export const PrivateCatalog1870 = new PrivateCatalog(
    {
        closurePhaseId: '4',
        privates: [
            {
                id: GreatRiverPrivateId,
                name: 'Great River Shipping Company',
                faceValue: 20,
                revenue: 5,
                description: 'No special abilities. Closes at phase 4.'
            },
            {
                id: BridgePrivateId,
                name: 'Mississippi River Bridge Company',
                faceValue: 40,
                revenue: 10,
                description: `Until a company buys it or it closes, no company may bridge the Mississippi. Its owning company may once build a tile in one hex along the river for $40 less, besides its ordinary lays. The Missouri Pacific or the St. Louis Southwestern may buy it in phase 1 for $20 to $40; bought in its first operating round, that company may instead lay a tile on its starting city free. Closes at phase 4.`
            },
            {
                id: CattlePrivateId,
                name: 'The Southern Cattle Company',
                faceValue: 50,
                revenue: 10,
                description:
                    'Its owning company may place a token on a city west of the Mississippi, not in a hex the river passes through, adding $10 there for that company alone. Placing it does not close the company. Closes at phase 4; the token stays until phase 5.'
            },
            {
                id: PortPrivateId,
                name: 'The Gulf Shipping Company',
                faceValue: 80,
                revenue: 15,
                description: `Its owning company may place a port on ${['H17', 'M14', 'M20', 'N7', 'N17'].map(place).join(', ')}, adding $20 there for that company. An open port also adds $10 for others; a closed port, placed at once or replacing the open port in a later operating round, closes this company. Closes at phase 4; the port stays until phase 5.`
            },
            {
                id: FriscoPrivateId,
                name: 'St. Louis-San Francisco Railway',
                faceValue: 140,
                revenue: 0,
                sale: 'never',
                description:
                    'The president’s certificate of the St. Louis-San Francisco Railway, whose par its buyer sets. That railway operates with just 20% sold.'
            },
            {
                id: KatyPrivateId,
                name: 'Missouri-Kansas-Texas Railroad',
                faceValue: 160,
                revenue: 20,
                description:
                    'Comes with a 10% share of the Missouri-Kansas-Texas Railroad. Closes at phase 4.'
            }
        ]
    },
    Phases1870
)
export const Privates1870 = PrivateCatalog1870.privates

export function privateDescription(privateCompanyId: string): string {
    return PrivateCatalog1870.definition(privateCompanyId).description ?? ''
}
