import { PrivateCatalog, type PrivateDefinition } from '@tabletop/18xx'
import { EighteenSeventeenPhases } from './trains.js'

const cityTile = (city: string, locationId: string) =>
    `The owning company may lay the special yellow tile X00 on ${city} (${locationId}) without a connection, as one of its lays. The power is lost if another company builds there first.`
const mineHexes = 'a mountain hex beside a city or offboard, without its $15 terrain cost'
const bridgeCities = 'Louisville, Cincinnati or Charleston'

// Privates pay nothing to players and never close by phase; a company acquires them only when
// its founding president contributes them, or through a merger or acquisition.
const privates: readonly Omit<PrivateDefinition, 'revenue' | 'closure'>[] = [
    {
        id: 'MINC',
        name: 'Minor Coal Mine',
        faceValue: 30,
        description: `The owning company may lay one yellow coal-mine tile on ${mineHexes}. Routes earn $10 through a mine but may not start or end there.`
    },
    {
        id: 'OBC',
        name: 'Ohio Bridge Company',
        faceValue: 40,
        description: `One $10 bridge token for ${bridgeCities}. The owning company pays no $10 river cost on yellow tiles.`
    },
    {
        id: 'MTE',
        name: 'Mountain Engineers',
        faceValue: 40,
        description: 'The owning company receives $20 after laying a yellow tile on a mountain hex.'
    },
    {
        id: 'PSM',
        name: 'Pittsburgh Steel Mill',
        faceValue: 40,
        description: cityTile('Pittsburgh', 'F13')
    },
    {
        id: 'CM',
        name: 'Coal Mine',
        faceValue: 60,
        description: `The owning company may lay two yellow coal-mine tiles on ${mineHexes}.`
    },
    {
        id: 'MINM',
        name: 'Minor Mail Contract',
        faceValue: 60,
        description:
            'Pays the owning company $10 at the start of each operating round while it owns a train.'
    },
    {
        id: 'TS',
        name: 'Train Station',
        faceValue: 80,
        description: 'Gives the owning company an additional station.'
    },
    {
        id: 'UBC',
        name: 'Union Bridge Company',
        faceValue: 80,
        description: `Two $10 bridge tokens for ${bridgeCities}. The owning company pays no $10 river cost on yellow tiles.`
    },
    {
        id: 'MAIL',
        name: 'Mail Contract',
        faceValue: 90,
        description:
            'Pays the owning company $15 at the start of each operating round while it owns a train.'
    },
    {
        id: 'MAJC',
        name: 'Major Coal Mine',
        faceValue: 90,
        description: `The owning company may lay three yellow coal-mine tiles on ${mineHexes}.`
    },
    {
        id: 'MAJM',
        name: 'Major Mail Contract',
        faceValue: 120,
        description:
            'Pays the owning company $20 at the start of each operating round while it owns a train.'
    }
]

const ranch = (tokens: string) =>
    `The owning company may lay ${tokens} yellow ranch tiles, as its lays, facing a neighbouring city, town or offboard and not beside a city tile. Routes earn $10 through a ranch, and nobody may upgrade it.`

// The Volatility expansion's privates.
const volatilityPrivates: readonly Omit<PrivateDefinition, 'revenue' | 'closure'>[] = [
    {
        id: 'P12',
        name: 'Loan Shark',
        faceValue: 60,
        description:
            'The company it is contributed to receives $60, and pays $10 more interest each operating round for the rest of the game.'
    },
    { id: 'P13', name: 'Ponzi Scheme', faceValue: 100, description: 'Does nothing.' },
    {
        id: 'P14',
        name: 'Inventor',
        faceValue: 70,
        description:
            'The bank pays the owning company $10 for each number of a train type the first time one leaves the depot (2+: nothing).'
    },
    {
        id: 'P15',
        name: 'Scrapper',
        faceValue: 40,
        description:
            'The bank pays the owning company for each of its trains that rusts: $30 for a 2 or 2+, $75 for a 3, $150 for a 4.'
    },
    {
        id: 'P16',
        name: 'Buffalo Rail Center',
        faceValue: 40,
        description: cityTile('Buffalo', 'C14')
    },
    { id: 'P17', name: 'Toledo Industry', faceValue: 40, description: cityTile('Toledo', 'D7') },
    {
        id: 'P18',
        name: 'Express Track',
        faceValue: 30,
        description:
            'The owning company’s first lay costs $10 and its second nothing; with Efficient Track both are free.'
    },
    {
        id: 'P19',
        name: 'Efficient Track',
        faceValue: 40,
        description:
            'The owning company’s second lay costs $10; with Express Track both lays are free.'
    },
    {
        id: 'P20',
        name: 'Golden Parachute',
        faceValue: 100,
        description:
            'The bank pays the owning company’s president $100 when another president’s company acquires it, or the bank liquidates it.'
    },
    {
        id: 'P21',
        name: 'Station Subsidy',
        faceValue: 70,
        description: 'The stations the owning company must buy when it converts cost $50 less.'
    },
    { id: 'P22', name: 'Country Ranch', faceValue: 30, description: ranch('one') },
    { id: 'P23', name: 'Rural Ranch', faceValue: 60, description: ranch('two') },
    {
        id: 'P24',
        name: 'Indianapolis Market',
        faceValue: 40,
        description: cityTile('Indianapolis', 'F3')
    }
]

export const BasePrivateIds = privates.map((item) => item.id)
export const VolatilityPrivateIds = volatilityPrivates.map((item) => item.id)
/** The privates that lay the X00 city tile, and their cities; Volatility keeps one of them. */
export const CityTilePrivates: Readonly<Record<string, string>> = {
    PSM: 'F13',
    P16: 'C14',
    P17: 'D7',
    P24: 'F3'
}

export const EighteenSeventeenPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '8',
        privates: [...privates, ...volatilityPrivates].map((item) => ({
            ...item,
            revenue: 0,
            closure: 'never' as const
        }))
    },
    EighteenSeventeenPhases
)
export const EighteenSeventeenPrivates = EighteenSeventeenPrivateCatalog.privates
