import type { SpaceId } from './board.js'
import type { Good, GuildId, VesselType } from './components.js'
import { ProvisionalCards } from './provisional.cards.js'
import type { RegionId } from './regionTiles.js'

export type MandateId = `writ.mandate.${number}`

/** R-4.4.2, R-7 What a mandate gives. */
export type MandateReward =
    | {
          readonly kind: 'attack' | 'shillings' | 'goods' | 'influence' | 'seal' | 'bead'
          readonly amount: number
      }
    | { readonly kind: 'vessel'; readonly vessel: VesselType }
    /** R-4.4-H4 The seat names the vessel when it plays the mandate. */
    | { readonly kind: 'any-vessel' }

export interface MandateAlternative {
    /** The rulebook's summary wording. */
    readonly text: string
    /** R-7 The boxed goods; the unboxed ones on a card are only the recipe picture. */
    readonly turnedIn: readonly Good[]
    readonly reward: MandateReward
    /** R-7 The printed `*`: the reward comes from the general supply. */
    readonly drawnFromSupply: boolean
}

export interface MandateGuildReward {
    readonly guild: GuildId
    readonly reward: MandateReward
    readonly drawnFromSupply: boolean
}

interface MandateBase {
    readonly id: MandateId
    /** The rulebook's card layout, not printed on the card. */
    readonly number: number
    /** R-4.4-H1 Also played during its holder's own attack. */
    readonly weapon: boolean
    readonly picture: string
}

/** R-4.4.2 Two alternatives, chosen when played. */
export interface TurnInMandate extends MandateBase {
    readonly kind: 'turn-in'
    readonly alternatives: readonly [MandateAlternative, MandateAlternative]
}

/** R-4.4.2 One reward per card, of a guild where its player has the status stars. */
export interface GuildStatusMandate extends MandateBase {
    readonly kind: 'guild-status'
    /** The rulebook's summary wording; `guildRewards` holds what each guild's reward gives. */
    readonly text: string
    readonly guildRewards: readonly MandateGuildReward[]
}

export type Mandate = TurnInMandate | GuildStatusMandate

/** R-7 */
export const MandateStatusStars = 3

/** R-4.4.4 Sealed charters included. */
export const WritLimit = 3

function shillings(amount: number): MandateReward {
    return { kind: 'shillings', amount }
}

function attack(amount: number): MandateReward {
    return { kind: 'attack', amount }
}

function vessel(type: VesselType): MandateReward {
    return { kind: 'vessel', vessel: type }
}

/** R-4.4.2, R-7 */
export const Mandates: readonly Mandate[] = [
    {
        id: 'writ.mandate.1',
        number: 1,
        kind: 'turn-in',
        weapon: true,
        picture: 'bow / crossbow',
        alternatives: [
            {
                text: 'Use bow for free: +1 attack',
                turnedIn: [],
                reward: attack(1),
                drawnFromSupply: false
            },
            {
                text: 'Turn in wood: +2 attack',
                turnedIn: ['wood'],
                reward: attack(2),
                drawnFromSupply: false
            }
        ]
    },
    {
        id: 'writ.mandate.2',
        number: 2,
        kind: 'turn-in',
        weapon: false,
        picture: 'A recipe iron, wood, boxed food; B recipe food, wood, boxed wood',
        alternatives: [
            {
                text: 'Turn in food: flying machine*',
                turnedIn: ['food'],
                reward: vessel('flying-machine'),
                drawnFromSupply: true
            },
            {
                text: 'Turn in wood: ship*',
                turnedIn: ['wood'],
                reward: vessel('ship'),
                drawnFromSupply: true
            }
        ]
    },
    {
        id: 'writ.mandate.3',
        number: 3,
        kind: 'turn-in',
        weapon: true,
        picture: 'sword / longsword',
        alternatives: [
            {
                text: 'Use sword for free: +1 attack',
                turnedIn: [],
                reward: attack(1),
                drawnFromSupply: false
            },
            {
                text: 'Turn in iron: +2 attack',
                turnedIn: ['iron'],
                reward: attack(2),
                drawnFromSupply: false
            }
        ]
    },
    {
        id: 'writ.mandate.4',
        number: 4,
        kind: 'turn-in',
        weapon: false,
        picture: 'A recipe food, wood, boxed wood; B recipe food, iron, boxed iron',
        alternatives: [
            {
                text: 'Turn in wood: ship*',
                turnedIn: ['wood'],
                reward: vessel('ship'),
                drawnFromSupply: true
            },
            {
                text: 'Turn in iron: submersible*',
                turnedIn: ['iron'],
                reward: vessel('submersible'),
                drawnFromSupply: true
            }
        ]
    },
    {
        id: 'writ.mandate.5',
        number: 5,
        kind: 'turn-in',
        weapon: false,
        picture: 'goods column saltpeter, sulfur, iron, wood, food with the turned-in ones boxed',
        alternatives: [
            {
                text: 'Turn in food: 3s',
                turnedIn: ['food'],
                reward: shillings(3),
                drawnFromSupply: false
            },
            {
                text: 'Turn in wood & food: 7s',
                turnedIn: ['wood', 'food'],
                reward: shillings(7),
                drawnFromSupply: false
            }
        ]
    },
    {
        id: 'writ.mandate.6',
        number: 6,
        kind: 'guild-status',
        weapon: false,
        picture: 'icons sheep, coins, gear, each 3★, under bag / 3s / ship',
        text: 'Reach 3★ in 1 guild to earn 3 goods, 3s or any vessel*',
        guildRewards: [
            { guild: 'farmer', reward: { kind: 'goods', amount: 3 }, drawnFromSupply: true },
            { guild: 'merchant', reward: shillings(3), drawnFromSupply: true },
            // R-4.4-H4 Any vessel, as the rulebook's summary reads; the card's icon is a ship.
            { guild: 'alchemist', reward: { kind: 'any-vessel' }, drawnFromSupply: true }
        ]
    },
    {
        id: 'writ.mandate.7',
        number: 7,
        kind: 'turn-in',
        weapon: false,
        picture: 'goods column with the turned-in ones boxed',
        alternatives: [
            {
                text: 'Turn in iron, wood & food: 9s',
                turnedIn: ['iron', 'wood', 'food'],
                reward: shillings(9),
                drawnFromSupply: false
            },
            {
                text: 'Turn in sulfur, iron, wood & food: 13s',
                turnedIn: ['sulfur', 'iron', 'wood', 'food'],
                reward: shillings(13),
                drawnFromSupply: false
            }
        ]
    },
    {
        id: 'writ.mandate.8',
        number: 8,
        kind: 'guild-status',
        weapon: false,
        picture: 'icons axe, crown, cross, each 3★',
        text: 'Reach 3★ in 1 guild to earn 3 influence*, 1 seal* or 1 bead*',
        guildRewards: [
            { guild: 'knight', reward: { kind: 'influence', amount: 3 }, drawnFromSupply: true },
            { guild: 'noble', reward: { kind: 'seal', amount: 1 }, drawnFromSupply: true },
            { guild: 'monk', reward: { kind: 'bead', amount: 1 }, drawnFromSupply: true }
        ]
    }
]

export type Kingdom = 'eastern' | 'western' | 'northern' | 'central' | 'southern' | 'isolated'

export type CharterId =
    `writ.charter.${Kingdom}-kingdom` | 'writ.charter.sulfur-barrel' | 'writ.charter.monster-defeat'

interface CharterBase {
    readonly id: CharterId
    /** The rulebook's summary wording. */
    readonly text: string
}

/** R-4.4.3 "Per location ruled" counts ruled spaces only, and a space may count for several. */
export interface KingdomCharter extends CharterBase {
    readonly kind: 'kingdom'
    readonly kingdom: Kingdom
    /** R-6.2-H1 Index 0 is 1 location ruled. */
    readonly vpByLocationsRuled: readonly number[]
    /** The card's dots. */
    readonly spaces: readonly SpaceId[]
}

export interface SulfurBarrelCharter extends CharterBase {
    readonly kind: 'sulfur-barrel'
    readonly vpBySulfur: readonly { readonly sulfur: number; readonly vp: number }[]
}

export interface MonsterDefeatCharter extends CharterBase {
    readonly kind: 'monster-defeat'
    readonly vp: number
}

export type Charter = KingdomCharter | SulfurBarrelCharter | MonsterDefeatCharter

const KingdomVp = [3, 5, 7, 9]
const IsolatedKingdomVp = [5, 11, 17]

function spaces(region: RegionId, first: number, last = first): SpaceId[] {
    return Array.from(
        { length: last - first + 1 },
        (_, index): SpaceId => `space.${region}.${first + index}`
    )
}

/** R-4.4.3, R-6.2 In the rulebook's list order. */
export const Charters: readonly Charter[] = [
    {
        id: 'writ.charter.sulfur-barrel',
        kind: 'sulfur-barrel',
        text: 'End game with 2 or 3 sulfur in barrel: 5/7 vp',
        vpBySulfur: [
            { sulfur: 2, vp: 5 },
            { sulfur: 3, vp: 7 }
        ]
    },
    {
        id: 'writ.charter.eastern-kingdom',
        kind: 'kingdom',
        kingdom: 'eastern',
        text: 'Eastern Kingdom (per location ruled): 3/5/7/9 vp',
        vpByLocationsRuled: KingdomVp,
        spaces: [...spaces('badlands', 1, 5), ...spaces('mountain', 1, 2)]
    },
    {
        id: 'writ.charter.monster-defeat',
        kind: 'monster-defeat',
        text: 'If you defeat either monster during game: 7 vp',
        vp: 7
    },
    {
        id: 'writ.charter.western-kingdom',
        kind: 'kingdom',
        kingdom: 'western',
        text: 'Western Kingdom (per location ruled): 3/5/7/9 vp',
        vpByLocationsRuled: KingdomVp,
        spaces: [...spaces('sea', 1, 3), ...spaces('island', 1, 4)]
    },
    {
        id: 'writ.charter.northern-kingdom',
        kind: 'kingdom',
        kingdom: 'northern',
        text: 'Northern Kingdom (per location ruled): 3/5/7/9 vp',
        vpByLocationsRuled: KingdomVp,
        spaces: [
            ...spaces('forest', 1, 3),
            ...spaces('badlands', 1),
            ...ProvisionalCards.northernKingdomSpaces.placeholder
        ]
    },
    {
        id: 'writ.charter.central-kingdom',
        kind: 'kingdom',
        kingdom: 'central',
        text: 'Central Kingdom (per location ruled): 3/5/7/9 vp',
        vpByLocationsRuled: KingdomVp,
        spaces: [...spaces('forest', 1, 3), ...spaces('desert', 1, 5)]
    },
    {
        id: 'writ.charter.southern-kingdom',
        kind: 'kingdom',
        kingdom: 'southern',
        text: 'Southern Kingdom (per location ruled): 3/5/7/9 vp',
        vpByLocationsRuled: KingdomVp,
        spaces: [...spaces('desert', 1, 5), ...spaces('badlands', 3, 5), ...spaces('mountain', 2)]
    },
    {
        id: 'writ.charter.isolated-kingdom',
        kind: 'kingdom',
        kingdom: 'isolated',
        text: 'Isolated Kingdom (per location ruled): 5/11/17 vp',
        vpByLocationsRuled: IsolatedKingdomVp,
        spaces: [...spaces('sea', 3), ...spaces('badlands', 3), ...spaces('badlands', 5)]
    }
]

export type RoyalWrit = Mandate | Charter
export type WritId = MandateId | CharterId

/** R-4.4 */
export const RoyalWrits: readonly RoyalWrit[] = [...Mandates, ...Charters]
