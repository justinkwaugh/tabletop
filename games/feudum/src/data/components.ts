import { FeudumColors } from '../definition/colors.js'

/** R-1.1 The six guilds, in the rulebook's order; a pawn's character names its guild. */
export const GuildIds = ['farmer', 'merchant', 'alchemist', 'knight', 'noble', 'monk'] as const
export type GuildId = (typeof GuildIds)[number]
export type Character = GuildId

/** R-1.1 */
export const Goods = ['saltpeter', 'sulfur', 'iron', 'wood', 'food'] as const
export type Good = (typeof Goods)[number]

/** R-1.1 */
export const VesselTypes = ['ship', 'submersible', 'flying-machine'] as const
export type VesselType = (typeof VesselTypes)[number]

/** R-4.2.4 */
export const MonsterIds = ['behemoth', 'sea-serpent'] as const
export type MonsterId = (typeof MonsterIds)[number]

export interface GoodRow {
    readonly id: `good.${Good}`
    readonly good: Good
    readonly count: number
    readonly colour: string
}

/** R-1.1 */
export const GoodRows: readonly GoodRow[] = [
    { id: 'good.saltpeter', good: 'saltpeter', count: 30, colour: 'white' },
    { id: 'good.sulfur', good: 'sulfur', count: 30, colour: 'yellow' },
    { id: 'good.iron', good: 'iron', count: 30, colour: 'black' },
    { id: 'good.wood', good: 'wood', count: 30, colour: 'brown' },
    { id: 'good.food', good: 'food', count: 50, colour: 'green' }
]

export interface ShillingCoin {
    readonly id: `shilling.${number}`
    readonly metal: 'silver' | 'gold'
    readonly value: number
    readonly count: number
}

/** R-1.1, R-1.1-H1: the coins in the box are every shilling there is. */
export const ShillingCoins: readonly ShillingCoin[] = [
    { id: 'shilling.1', metal: 'silver', value: 1, count: 43 },
    { id: 'shilling.5', metal: 'gold', value: 5, count: 7 }
]

export interface VesselRow {
    readonly id: `vessel.${VesselType}`
    readonly vessel: VesselType
    readonly count: number
}

/** R-4.2.2 */
export const VesselRows: readonly VesselRow[] = [
    { id: 'vessel.ship', vessel: 'ship', count: 3 },
    { id: 'vessel.submersible', vessel: 'submersible', count: 3 },
    { id: 'vessel.flying-machine', vessel: 'flying-machine', count: 3 }
]

export interface MonsterRow {
    readonly id: `monster.${MonsterId}`
    readonly monster: MonsterId
    readonly media: readonly ('road' | VesselType)[]
    readonly attack: number
    readonly defence: number
}

/** R-4.2.4 */
export const Monsters: readonly MonsterRow[] = [
    {
        id: 'monster.behemoth',
        monster: 'behemoth',
        media: ['road', 'flying-machine'],
        attack: 1,
        defence: 1
    },
    {
        id: 'monster.sea-serpent',
        monster: 'sea-serpent',
        media: ['ship', 'submersible'],
        attack: 1,
        defence: 1
    }
]

export interface PawnFace {
    readonly id: `pawn.face.${Character}`
    readonly character: Character
    readonly icon: string
    readonly guild: `guild.${GuildId}`
}

/** R-1.1, R-4.5.1 */
export const PawnFaces: readonly PawnFace[] = [
    { id: 'pawn.face.farmer', character: 'farmer', icon: 'sheep', guild: 'guild.farmer' },
    { id: 'pawn.face.merchant', character: 'merchant', icon: 'coins', guild: 'guild.merchant' },
    { id: 'pawn.face.alchemist', character: 'alchemist', icon: 'gear', guild: 'guild.alchemist' },
    { id: 'pawn.face.knight', character: 'knight', icon: 'axe', guild: 'guild.knight' },
    { id: 'pawn.face.noble', character: 'noble', icon: 'crown', guild: 'guild.noble' },
    { id: 'pawn.face.monk', character: 'monk', icon: 'cross', guild: 'guild.monk' }
]

const PawnsPerColour = 3
const PlayerDiscsPerColour = 4
const MarkersPerColour = 20
const ArcheryTargets = 12

/** R-1.1, R-4.7: one disc scores; the rest are shared by at most 2 reeves, the voyage and service. */
export const PlayerDiscRoles = { scoring: 1, shared: 3, reevesAtMost: 2 } as const

/** R-4.10.2 */
export const WineBarrelCapacity = 3

export interface ComponentRow {
    readonly id: string
    readonly count: number
}

function perColour(prefix: string, count: number): ComponentRow[] {
    return FeudumColors.map((colour) => ({ id: `${prefix}.${colour}`, count }))
}

/** R-1.1 One row per component kind, identical pieces sharing a row. Ids are permanent. */
export const ComponentRows: readonly ComponentRow[] = [
    { id: 'board.main', count: 1 },
    ...perColour('pawn', PawnsPerColour),
    ...perColour('player-disc', PlayerDiscsPerColour),
    ...perColour('marker.influence', MarkersPerColour),
    ...perColour('pouch', 1),
    ...perColour('barrel', 1),
    ...VesselRows,
    ...Monsters.map(({ id }) => ({ id, count: 1 })),
    ...GoodRows,
    ...ShillingCoins,
    { id: 'target.archery', count: ArcheryTargets },
    { id: 'die.progress', count: 1 },
    { id: 'marker.epoch', count: 1 },
    { id: 'marker.start-player', count: 1 },
    { id: 'bag.haversack', count: 1 }
]

function total<T>(rows: readonly T[], amount: (row: T) => number): number {
    return rows.reduce((sum, row) => sum + amount(row), 0)
}

/** R-1.1, R-1.1-H1 Every component is limited to these. */
export const ComponentTotals = {
    colours: FeudumColors.length,
    goods: total(GoodRows, (row) => row.count),
    shillings: total(ShillingCoins, (coin) => coin.value * coin.count),
    shillingCoins: total(ShillingCoins, (coin) => coin.count),
    markersPerColour: MarkersPerColour,
    markers: MarkersPerColour * FeudumColors.length,
    vessels: total(VesselRows, (row) => row.count),
    monsters: Monsters.length,
    targets: ArcheryTargets,
    pawnsPerColour: PawnsPerColour,
    pawns: PawnsPerColour * FeudumColors.length,
    playerDiscsPerColour: PlayerDiscsPerColour,
    playerDiscs: PlayerDiscsPerColour * FeudumColors.length,
    pawnFaces: PawnFaces.length
} as const

/** R-1.4.1 What each player takes into their personal supply. */
export const StartingSupply = {
    pawns: PawnsPerColour,
    playerDiscs: PlayerDiscsPerColour,
    actionCards: 11,
    markers: 7,
    food: 7,
    shillings: 7,
    pouches: 1
} as const
