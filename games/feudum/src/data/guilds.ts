import type { Color } from '@tabletop/common'
import { FeudumColors } from '../definition/colors.js'
import {
    Goods,
    GuildIds,
    MonsterIds,
    type Good,
    type GuildId,
    type MonsterId,
    type VesselType
} from './components.js'
import { ProvisionalGuilds, type CharityId } from './provisional.guilds.js'

export type { CharityId }

/** R-1.2.4 Each location type is related to two guilds. */
export type RelatedLocation = 'outpost' | 'farm' | 'town'

export interface GuildRow {
    readonly id: `guild.${GuildId}`
    readonly guild: GuildId
    readonly name: string
    /** R-1.2.4 Ruling one gives a secondary status star here (R-4.5.1). */
    readonly relatedLocation: RelatedLocation
    /** R-1.2.3 The guild before this one in the ring. */
    readonly pullsFrom: GuildId
    /** R-1.2.3 The guild after this one in the ring. */
    readonly pushesTo: GuildId
    /** R-4.6.2, R-4.6-H3 What receives this guild's apprentice share. */
    readonly charity: CharityId
}

/** R-1.2.3, R-1.2.4 */
export const GuildById: Readonly<Record<GuildId, GuildRow>> = {
    farmer: {
        id: 'guild.farmer',
        guild: 'farmer',
        name: 'Farmer',
        relatedLocation: 'farm',
        pullsFrom: 'monk',
        pushesTo: 'merchant',
        charity: ProvisionalGuilds.charity.placeholder.farmer
    },
    merchant: {
        id: 'guild.merchant',
        guild: 'merchant',
        name: 'Merchant',
        relatedLocation: 'town',
        pullsFrom: 'farmer',
        pushesTo: 'alchemist',
        charity: ProvisionalGuilds.charity.placeholder.merchant
    },
    alchemist: {
        id: 'guild.alchemist',
        guild: 'alchemist',
        name: 'Alchemist',
        relatedLocation: 'outpost',
        pullsFrom: 'merchant',
        pushesTo: 'knight',
        charity: ProvisionalGuilds.charity.placeholder.alchemist
    },
    knight: {
        id: 'guild.knight',
        guild: 'knight',
        name: 'Knight',
        relatedLocation: 'farm',
        pullsFrom: 'alchemist',
        pushesTo: 'noble',
        charity: ProvisionalGuilds.charity.placeholder.knight
    },
    noble: {
        id: 'guild.noble',
        guild: 'noble',
        name: 'Noble',
        relatedLocation: 'town',
        pullsFrom: 'knight',
        pushesTo: 'monk',
        charity: ProvisionalGuilds.charity.placeholder.noble
    },
    monk: {
        id: 'guild.monk',
        guild: 'monk',
        name: 'Monk',
        relatedLocation: 'outpost',
        pullsFrom: 'noble',
        pushesTo: 'farmer',
        charity: ProvisionalGuilds.charity.placeholder.monk
    }
}

/** R-1.2.3 The ring runs in the order of `GuildIds`, and the last guild's next is the first. */
export const GuildRing: readonly GuildId[] = GuildIds

export const GuildRows: readonly GuildRow[] = GuildRing.map((guild) => GuildById[guild])

/** R-4.5.1 The key printed on each guild. */
export const StatusStarValues = { pawn: 1, feudum: 3, relatedLocation: 1 } as const

/** R-1.3 Left to right on a guild's track. */
export const GuildRanks = ['apprentice', 'journeyman', 'master'] as const
export type GuildRank = (typeof GuildRanks)[number]

export interface GuildRankRow {
    readonly rank: GuildRank
    /** R-4.12.1 */
    readonly dawnVp: number
    /** R-4.6.4, R-4.6.5 */
    readonly guildFunction: 'pull' | 'push' | null
    /** R-4.5.3 */
    readonly minPlayers: number
}

const GuildRankRows: readonly GuildRankRow[] = [
    { rank: 'apprentice', dawnVp: 1, guildFunction: null, minPlayers: 4 },
    { rank: 'journeyman', dawnVp: 3, guildFunction: 'pull', minPlayers: 2 },
    { rank: 'master', dawnVp: 5, guildFunction: 'push', minPlayers: 2 }
]

export interface GuildTrackSpace extends GuildRankRow {
    readonly id: `guild.${GuildId}.track.${GuildRank}`
    readonly guild: GuildId
}

/** R-1.3, R-4.5.3 */
export const GuildTrackSpaces: readonly GuildTrackSpace[] = GuildIds.flatMap((guild) =>
    GuildRankRows.map((row) => ({ id: `guild.${guild}.track.${row.rank}` as const, guild, ...row }))
)

/** R-1.3, R-4.6.3 */
export const FarmerBarn = { id: 'guild.farmer.barn', capacity: 10, setupGoods: 10 } as const

/** R-4.6.2 Empty at setup. */
export const FarmerPurse = { id: 'guild.farmer.purse' } as const

/** R-4.6.3 The trade medallion: 1 food or 1 shilling per this many goods sent. */
export const FarmerTradeGoods = 2

/** R-4.6.4 A Farmer pull's threshold: the chicken beads' sum. */
export const FarmerPullThreshold = 5

/** R-4.6.5 */
export const FarmerPushGoods = 5

/** R-4.6.3 */
export const MerchantTradeGoods = 3

/** R-4.6.4 */
export const MerchantPullGoods = 3

/** R-4.6.5 The goods a Merchant push moves from the market to the carts and piles. */
export const MerchantPushGoods = 4

/** R-4.6.3 What a vessel for sale costs. */
export const AlchemistTradePrice = 3

/** R-4.6.4 The goods an Alchemist pull moves from the market to the carts and piles. */
export const AlchemistPullGoods = 2

/** R-4.6.5 */
export const AlchemistPushInventions = 3

/** R-4.6.3 What taking a Knight row costs, however many markers it holds. */
export const KnightTradePrice = 3

/** R-4.6.4 */
export const KnightPullInventions = 1

/** R-4.6.5 The most markers a Knight push moves from the rows, each replaced by a seal. */
export const KnightPushMarkers = 3

/** R-4.6.3, R-4.6-H1 What a seal bought from the scrolls costs, and the most one trade buys. */
export const NobleTradePrice = 3
export const NobleTradeSeals = 2

/** R-4.6.4 The markers a Noble pull moves from the rows, each replaced by a seal. */
export const NoblePullMarkers = 2

/** R-4.6.5 */
export const NoblePushSeals = 2

/** R-4.6.5 The rosary totals that reach a Noble push's first, second and third level. */
export const NoblePushTotals = [5, 11, 17] as const

/** R-4.6.3 What a bead from the rosary costs. */
export const MonkTradePrice = 3

/** R-4.6.4 */
export const MonkPullSeals = 1

/** R-4.6.4 A Monk pull's threshold: the rosary's total. */
export const MonkPullThreshold = 11

/** R-4.6.5 The chicken totals that reach a Monk push's first, second and third level. */
export const MonkPushTotals = [3, 6, 9] as const

/** R-4.6.4 A pull reaching its threshold. */
export const PullReward = { vp: 3, writs: { draw: 2, keep: 1 } } as const

/** R-4.6.5 A push's points for 1, 2 and 3 or more completions. */
export const PushVp = [4, 5, 6] as const

export interface ChickenSpace {
    readonly id: `guild.farmer.chicken.${number}`
    readonly space: number
    readonly capacity: number
    readonly setupBead: boolean
}

/** R-1.3 */
export type ChickenSpaceId = ChickenSpace['id']

/** R-1.3, R-1.4-H3 */
export const ChickenSpaces: readonly ChickenSpace[] = Array.from(
    { length: ProvisionalGuilds.chickenSpaces.placeholder.spaces },
    (_, index) => {
        const id = `guild.farmer.chicken.${index + 1}` as const
        return {
            id,
            space: index + 1,
            capacity: 1,
            setupBead: id === ProvisionalGuilds.chickenSpaces.placeholder.setupBeadSpace
        }
    }
)

const MarketSlots = [1, 2, 3, 4] as const
type MarketSlot = (typeof MarketSlots)[number]

/** R-1.3 In shillings. Each bin runs from most to least expensive, in fill order. */
const MarketPrices: Readonly<Record<Good, Readonly<Record<MarketSlot, number>>>> = {
    saltpeter: { 1: 4, 2: 3, 3: 2, 4: 2 },
    sulfur: { 1: 3, 2: 3, 3: 2, 4: 1 },
    iron: { 1: 3, 2: 2, 3: 1, 4: 1 },
    wood: { 1: 2, 2: 2, 3: 1, 4: 1 },
    food: { 1: 2, 2: 1, 3: 1, 4: 1 }
}

/** R-1.3 Setup fills a bin up to this space. */
const MarketSetupFill: Readonly<Record<Good, MarketSlot>> = {
    saltpeter: 3,
    sulfur: 3,
    iron: 4,
    wood: 4,
    food: 4
}

export type MarketSpaceId = `guild.merchant.space.${Good}-${MarketSlot}`

export interface MarketSpace {
    readonly id: MarketSpaceId
    /** The bin, and the only good this space holds. */
    readonly good: Good
    /** R-4.6.3 Goods come in at the lowest empty space, and are bought from the highest filled. */
    readonly space: MarketSlot
    readonly price: number
    readonly filledAtSetup: boolean
}

/** R-1.3, R-4.6.3 Five bins by four spaces, in bin order. */
export const MarketSpaces: readonly MarketSpace[] = Goods.flatMap((good) =>
    MarketSlots.map((space) => ({
        id: `guild.merchant.space.${good}-${space}` as const,
        good,
        space,
        price: MarketPrices[good][space],
        filledAtSetup: space <= MarketSetupFill[good]
    }))
)

const CartGoods = ['wood', 'iron', 'food', 'sulfur', 'saltpeter'] as const
type CartGood = (typeof CartGoods)[number]
const CartSlots = [1, 2, 3] as const
type CartSlot = (typeof CartSlots)[number]

/** R-1.3 Setup fills a cart or pile up to this space. */
const CartSetupFill: Readonly<Record<CartGood, CartSlot>> = {
    wood: 3,
    iron: 3,
    food: 1,
    sulfur: 1,
    saltpeter: 3
}

export type CartSpaceId = `guild.alchemist.cart.${CartGood}-${CartSlot}`

export interface AlchemistCartSpace {
    readonly id: CartSpaceId
    readonly good: CartGood
    readonly space: CartSlot
    readonly filledAtSetup: boolean
}

/** R-1.3 The production carts and piles. */
export const AlchemistCartSpaces: readonly AlchemistCartSpace[] = CartGoods.flatMap((good) =>
    CartSlots.map((space) => ({
        id: `guild.alchemist.cart.${good}-${space}` as const,
        good,
        space,
        filledAtSetup: space <= CartSetupFill[good]
    }))
)

/** R-1.3, R-4.2.3 Vessels for sale, covering the ferry symbol. */
export const AlchemistVesselSpace = { id: 'guild.alchemist.vessel-space', setupVessels: 2 } as const

/** The goods an invention uses from the carts. */
export type Recipe = Readonly<Partial<Record<Good, number>>>

export interface VesselInvention {
    readonly id: `guild.alchemist.invention.${VesselType}`
    readonly vessel: VesselType
    readonly recipe: Recipe
}

/** R-4.6.5 */
export const VesselInventions: readonly VesselInvention[] = [
    { id: 'guild.alchemist.invention.ship', vessel: 'ship', recipe: { food: 1, wood: 2 } },
    {
        id: 'guild.alchemist.invention.submersible',
        vessel: 'submersible',
        recipe: { food: 1, iron: 2 }
    },
    {
        id: 'guild.alchemist.invention.flying-machine',
        vessel: 'flying-machine',
        recipe: { food: 1, iron: 1, wood: 1 }
    }
]

export interface KrudBarrel {
    readonly id: `guild.alchemist.invention.krud-${number}`
    /** R-4.6-H4 Which barrel of one action this prices. */
    readonly barrel: number
    readonly recipe: Recipe
}

/** R-4.6.5, R-4.6.6, R-4.6-H4 */
export const KrudBarrels: readonly KrudBarrel[] = [
    { id: 'guild.alchemist.invention.krud-1', barrel: 1, recipe: { saltpeter: 2, sulfur: 1 } },
    { id: 'guild.alchemist.invention.krud-2', barrel: 2, recipe: { saltpeter: 1, sulfur: 1 } },
    { id: 'guild.alchemist.invention.krud-3', barrel: 3, recipe: { wood: 1 } }
]

/** R-4.6.5 */
export const Inventions: readonly (VesselInvention | KrudBarrel)[] = [
    ...VesselInventions,
    ...KrudBarrels
]

type KnightSectionNumber = 1 | 2 | 3

export interface KnightSection {
    readonly section: KnightSectionNumber
    readonly spaces: number
    readonly firstColumn: number
    readonly lastColumn: number
    /** R-1.3 */
    readonly setupMarkers: number
}

/** R-1.4-H1 Dummy rows make up the difference at 2 and 3 players. */
export const MinimumKnightRows = 4

/** R-1.3, R-1.4-H1 Given at setup and never changed. */
export const KnightRowIds = FeudumColors.map((_, index) => `knight-row-${index + 1}` as const)
export type KnightRowId = (typeof KnightRowIds)[number]

/** R-1.3, R-4.6.6 The barrel sections of any Knight row, player or dummy. */
export const KnightSections: readonly KnightSection[] = [
    { section: 1, spaces: 1, firstColumn: 1, lastColumn: 1, setupMarkers: 1 },
    { section: 2, spaces: 2, firstColumn: 2, lastColumn: 3, setupMarkers: 1 },
    { section: 3, spaces: 3, firstColumn: 4, lastColumn: 6, setupMarkers: 0 }
]

export interface KnightRowSection extends KnightSection {
    readonly id: `guild.knight.row.${Color}.section.${KnightSectionNumber}`
    /** The row's printed colour, for presentation; no rule reads it. */
    readonly colour: Color
}

/** R-1.3, R-1.4.4 Every printed section; rows not in play stay empty. */
export const KnightRowSections: readonly KnightRowSection[] = FeudumColors.flatMap((colour) =>
    KnightSections.map((section) => ({
        id: `guild.knight.row.${colour}.section.${section.section}` as const,
        colour,
        ...section
    }))
)

export interface KnightMonsterIcon {
    readonly id: `guild.knight.monster.${MonsterId}`
    readonly monster: MonsterId
    /** R-4.6.3 What taming this monster costs in returned markers. */
    readonly markers: number
}

/** R-4.6.3 Of the markers a tame returns, this many lie on the icon; the rest go to the supply. */
export const TameMarkersOnIcon = 1

/** R-4.2.4, R-4.6.3 */
export const KnightMonsterIcons: readonly KnightMonsterIcon[] = MonsterIds.map((monster) => ({
    id: `guild.knight.monster.${monster}` as const,
    monster,
    markers: 3
}))

export interface ScrollSpace {
    readonly id: `guild.noble.scroll.r${number}c${number}`
    readonly row: number
    readonly column: number
    readonly rowLength: number
    readonly columnLength: number
    readonly setupSeal: boolean
}

/** R-1.3 Rows of 3, 2, 1, left-aligned, giving three rows and three columns of those lengths. */
export const ScrollSpaces = [
    {
        id: 'guild.noble.scroll.r1c1',
        row: 1,
        column: 1,
        rowLength: 3,
        columnLength: 3,
        setupSeal: true
    },
    {
        id: 'guild.noble.scroll.r1c2',
        row: 1,
        column: 2,
        rowLength: 3,
        columnLength: 2,
        setupSeal: false
    },
    {
        id: 'guild.noble.scroll.r1c3',
        row: 1,
        column: 3,
        rowLength: 3,
        columnLength: 1,
        setupSeal: true
    },
    {
        id: 'guild.noble.scroll.r2c1',
        row: 2,
        column: 1,
        rowLength: 2,
        columnLength: 3,
        setupSeal: false
    },
    {
        id: 'guild.noble.scroll.r2c2',
        row: 2,
        column: 2,
        rowLength: 2,
        columnLength: 2,
        setupSeal: true
    },
    {
        id: 'guild.noble.scroll.r3c1',
        row: 3,
        column: 1,
        rowLength: 1,
        columnLength: 3,
        setupSeal: true
    }
] as const satisfies readonly ScrollSpace[]

export type ScrollSpaceId = (typeof ScrollSpaces)[number]['id']

/** R-1.3, R-1.4-H3 Beads, bead side up. */
export const MonkRosary: {
    readonly id: 'guild.monk.rosary'
    readonly capacity: number | 'unlimited'
    readonly setupBeads: number
} = {
    id: 'guild.monk.rosary',
    capacity: ProvisionalGuilds.rosaryCapacity.placeholder,
    setupBeads: 4
}

/** R-4.6.2 Empty at setup. */
export const MonkCoffer = { id: 'guild.monk.coffer' } as const

export interface GuildSetupFill {
    readonly farmer: {
        readonly barnGoods: number
        readonly chickenSpaces: readonly ChickenSpace['id'][]
    }
    readonly merchant: { readonly marketSpaces: readonly MarketSpaceId[] }
    readonly alchemist: {
        readonly cartSpaces: readonly CartSpaceId[]
        readonly vessels: number
    }
    readonly knight: { readonly markersPerRow: number }
    readonly noble: { readonly scrollSpaces: readonly ScrollSpaceId[] }
    readonly monk: { readonly beads: number }
}

/** R-1.3, R-4.12.5 Anything already beyond these stays. */
export const GuildSetupSpaces: GuildSetupFill = {
    farmer: {
        barnGoods: FarmerBarn.setupGoods,
        chickenSpaces: ChickenSpaces.filter((space) => space.setupBead).map((space) => space.id)
    },
    merchant: {
        marketSpaces: MarketSpaces.filter((space) => space.filledAtSetup).map((space) => space.id)
    },
    alchemist: {
        cartSpaces: AlchemistCartSpaces.filter((space) => space.filledAtSetup).map(
            (space) => space.id
        ),
        vessels: AlchemistVesselSpace.setupVessels
    },
    knight: {
        markersPerRow: KnightSections.reduce((sum, section) => sum + section.setupMarkers, 0)
    },
    noble: {
        scrollSpaces: ScrollSpaces.filter((space) => space.setupSeal).map((space) => space.id)
    },
    monk: { beads: MonkRosary.setupBeads }
}
