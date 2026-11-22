import { shuffle, type Prng } from '@tabletop/common'
import { PrivateCatalog, placeReference as place, type PrivateDefinition } from '@tabletop/18xx'
import { EighteenUSAPhases } from './trains.js'
import { GreatNorthernBorderIds } from './mapFeatures.js'

type PrivateText = Omit<PrivateDefinition, 'revenue' | 'closure'>

const tokens = (count: string, kind: string, section: string) =>
    `Comes with ${count} ${kind} token${count === 'one' ? '' : 's'} (${section}).`
const riverWaiver = 'The owning company pays no $10 river costs.'

// Privates pay nothing and never close by phase; a company acquires them only when its
// founding president contributes them, or through a merger or acquisition.
const privates: readonly PrivateText[] = [
    {
        id: 'P1',
        name: 'Lehigh Coal Mine Co.',
        faceValue: 30,
        description: tokens('one', 'coal', '§13.1')
    },
    {
        id: 'P2',
        name: 'Fox Bridge Works',
        faceValue: 40,
        description: `${tokens('one', 'bridge', '§13.4')} ${riverWaiver}`
    },
    {
        id: 'P3',
        name: 'Reece Oil and Gas',
        faceValue: 40,
        description: tokens('one', 'oil', '§13.2')
    },
    {
        id: 'P4',
        name: 'Hendrickson Iron',
        faceValue: 40,
        description: tokens('one', 'ore', '§13.3')
    },
    {
        id: 'P5',
        name: 'Nobel’s Blasting Powder',
        faceValue: 30,
        description:
            'The owning company pays no $15 mountain costs. Nothing is refunded when it uses a coal or ore token.'
    },
    {
        id: 'P6',
        name: 'Import / Export Hub',
        faceValue: 30,
        description:
            'Discard to replace the value token of a red area the company can reach with the 30/40/50/80 token.'
    },
    {
        id: 'P7',
        name: 'Track Engineers',
        faceValue: 40,
        description:
            'Pay $20 to lay three tiles, one of which may be an upgrade, in place of the normal track action.'
    },
    {
        id: 'P8',
        name: 'Express Freight Service',
        faceValue: 40,
        description:
            'Place an extra station token in one red area: each of the company’s trains running there earns $10 more for the rest of the game.'
    },
    {
        id: 'P9',
        name: 'Boomtown',
        faceValue: 40,
        description:
            'Discard during the track step to upgrade a reachable yellow non-metropolis city to green, besides the normal track action.'
    },
    {
        id: 'P10',
        name: 'Carnegie Steel Company',
        faceValue: 40,
        description:
            'Holds the three metropolis tiles not placed at setup. A company its owner starts in one of those cities makes it a metropolis.'
    },
    {
        id: 'P11',
        name: 'Pettibone & Mulliken',
        faceValue: 40,
        description:
            'With the $20 second tile action the company may make two upgrades, at most one of a city, and may upgrade non-city track one colour beyond the phase.'
    },
    {
        id: 'P12',
        name: 'Standard Oil Co.',
        faceValue: 60,
        description: tokens('two', 'oil', '§13.2')
    },
    {
        id: 'P13',
        name: 'Pennsy Boneyard',
        faceValue: 60,
        description:
            'Discard to keep one of the company’s trains from rusting until the end of its next run. It cannot be sold and counts against the limit.'
    },
    {
        id: 'P14',
        name: 'Pyramid Scheme',
        faceValue: 60,
        description: 'No special ability; its minimum bid is $5.'
    },
    {
        id: 'P15',
        name: 'Western Land Grant',
        faceValue: 60,
        description:
            'The company may take one extra loan, at a fixed $5 interest a round; it is normally repaid last.'
    },
    {
        id: 'P16',
        name: 'Regional Headquarters',
        faceValue: 60,
        description:
            'Comes with the gray Regional Headquarters tile, to upgrade a green or brown non-metropolis city from phase 5. Three of its exits may point at water or off the map.'
    },
    {
        id: 'P17',
        name: 'Great Northern Railway',
        faceValue: 60,
        description: `$30 when one train runs to ${place('B14')} and ${place('B8')}, and $30 more if it also runs to ${place('B2')} and ${place('D20')}. One extra free yellow lay a turn, ignoring terrain, on ${GreatNorthernBorderIds.map(place).join(', ')}.`
    },
    {
        id: 'P18',
        name: 'Peabody Coal Company',
        faceValue: 60,
        description: tokens('two', 'coal', '§13.1')
    },
    {
        id: 'P19',
        name: 'Union Switch & Signal',
        faceValue: 80,
        description:
            'Each run, one train may pass one city as though it had no city or stations, even a full one.'
    },
    {
        id: 'P20',
        name: 'Suem & Wynn Law Firm',
        faceValue: 80,
        description:
            'Discard to place a station in a city with no open slot; it fills the next slot to open.'
    },
    {
        id: 'P21',
        name: 'Keystone Bridge Co.',
        faceValue: 80,
        description: `Comes with one bridge token and one ore or coal token, the kind chosen when it is placed. ${riverWaiver}`
    },
    {
        id: 'P22',
        name: 'American Bridge Company',
        faceValue: 80,
        description: `${tokens('two', 'bridge', '§13.4')} ${riverWaiver}`
    },
    {
        id: 'P23',
        name: 'Bailey Yard',
        faceValue: 80,
        description: 'The company receives one bonus station token.'
    },
    {
        id: 'P24',
        name: 'Anaconda Copper',
        faceValue: 90,
        description: tokens('two', 'ore', '§13.3')
    },
    {
        id: 'P25',
        name: 'American Locomotive Co.',
        faceValue: 90,
        description:
            'The company buys trains from the bank at a 10% discount, or discards this before running to buy one at that discount. Discarded by the first 6-train.'
    },
    {
        id: 'P26',
        name: 'Rural Junction',
        faceValue: 90,
        description:
            'Three rural junction tiles for empty city hexes, never beside each other: $10 to every train through them, using none of its distance, never a route end, never upgraded.'
    },
    {
        id: 'P27',
        name: 'Company Town',
        faceValue: 90,
        description:
            'Place one Company Town tile on an empty hex not beside a metropolis, with a bonus station of the company; others may not station there and earn $10 less from it.'
    },
    {
        id: 'P28',
        name: 'Consolidation Coal Co.',
        faceValue: 90,
        description: tokens('three', 'coal', '§13.1')
    },
    {
        id: 'P29',
        name: 'Bankrupt Railroad',
        faceValue: 120,
        description:
            'A company started with it in a city whose subsidy tile was “No subsidy” receives a free 2-train.'
    },
    {
        id: 'P30',
        name: 'Double Heading',
        faceValue: 120,
        description: 'Each turn one 2- through 4+-train may run to one extra city.'
    }
]

/**
 * The subsidies a company keeps after its start until it uses them, held on its charter as
 * privates of no value; the bank holds them until a company starts in their city (§11.6.1).
 */
export const SubsidyPrivateIds = {
    boomtown: 'S-boomtown',
    freeStation: 'S-free-station',
    resource: 'S-resource'
} as const
const subsidyPrivates: readonly PrivateText[] = [
    {
        id: SubsidyPrivateIds.boomtown,
        name: 'Boomtown subsidy',
        faceValue: 0,
        description:
            'Upgrades the company’s home city to green during its first operating round, as a free extra action.'
    },
    {
        id: SubsidyPrivateIds.freeStation,
        name: 'Free Station subsidy',
        faceValue: 0,
        description:
            'One extra station, placeable in any city the company can reach, even one without an open slot.'
    },
    {
        id: SubsidyPrivateIds.resource,
        name: 'Resource subsidy',
        faceValue: 0,
        description:
            'One ore, oil or coal token of a kind whose privates are not all in play, placed with a free extra yellow lay.'
    }
]

export const EighteenUSAPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '8',
        privates: [...privates, ...subsidyPrivates].map((item) => ({
            ...item,
            revenue: 0,
            closure: 'never' as const
        }))
    },
    EighteenUSAPhases
)
export const EighteenUSAPrivates = EighteenUSAPrivateCatalog.privates.filter(
    (item) => !isSubsidyPrivate(item.id)
)

export function isSubsidyPrivate(privateId: string): boolean {
    return Object.values<string>(SubsidyPrivateIds).includes(privateId)
}

/** In every game, with P10 Carnegie Steel too from five players (§2.3). */
export function guaranteedPrivateIds(playerCount: number): string[] {
    return playerCount >= 5 ? ['P1', 'P2', 'P3', 'P4', 'P10'] : ['P1', 'P2', 'P3', 'P4']
}

/** How many of the other privates of each face value are drawn (§2.3). */
export const PrivatesDrawnByFaceValue: Readonly<Record<number, number>> = {
    30: 1,
    40: 2,
    60: 3,
    80: 2,
    90: 2,
    120: 1
}

/** The privates in play: the guaranteed ones and a random draw of each face value, in order. */
export function selectPrivates(playerCount: number, prng: Prng): string[] {
    const guaranteed = guaranteedPrivateIds(playerCount)
    const drawn = Object.entries(PrivatesDrawnByFaceValue).flatMap(([faceValue, count]) => {
        const candidates = EighteenUSAPrivates.filter(
            (item) => item.faceValue === Number(faceValue) && !guaranteed.includes(item.id)
        ).map((item) => item.id)
        shuffle(candidates, prng.random)
        return candidates.slice(0, count)
    })
    return EighteenUSAPrivates.map((item) => item.id).filter(
        (id) => guaranteed.includes(id) || drawn.includes(id)
    )
}
