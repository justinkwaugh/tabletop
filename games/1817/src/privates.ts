import { PrivateCatalog, type PrivateDefinition } from '@tabletop/18xx'
import { EighteenSeventeenPhases } from './trains.js'

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
        description:
            'The owning company may lay the special yellow tile X00 on Pittsburgh (F13) without a connection, as one of its lays. The power is lost if another company builds there first.'
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

export const EighteenSeventeenPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '8',
        privates: privates.map((item) => ({ ...item, revenue: 0, closure: 'never' as const }))
    },
    EighteenSeventeenPhases
)
export const EighteenSeventeenPrivates = EighteenSeventeenPrivateCatalog.privates
