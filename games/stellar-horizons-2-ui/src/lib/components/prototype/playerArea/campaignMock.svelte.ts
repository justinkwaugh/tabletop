// PROTOTYPE: mock mid-campaign data and switch state for the player-area variants. Throwaway.
// Three variants of the player area, switchable via `?players=A|B|C` on the game table:
// A (ledger: standings list plus one console), B (faction sheets: a card per player) and
// C (command deck: slim rows plus a wide faction sheet along the bottom of the map). D is the
// direction chosen from those: A's aligned rows, with C's sheet on wide screens only.
import { MediaQuery } from 'svelte/reactivity'
import {
    Faction,
    TECHS,
    TechField,
    factionShips,
    type ShipDefinition
} from '@tabletop/stellar-horizons-2'

export const PLAYER_VARIANTS = [
    { key: 'D', name: 'Rows; sheet under the map, or stacked on narrow screens' },
    { key: 'A', name: 'Ledger: standings and one console' },
    { key: 'B', name: 'Faction sheets: a card per player' },
    { key: 'C', name: 'Command deck: rows and a sheet under the map' }
] as const
export type PlayerVariantKey = (typeof PLAYER_VARIANTS)[number]['key']

export interface MockShip {
    ship: ShipDefinition
    system: string
    transit: number
    damage: number
    settlements: number
    goods: number
}

export interface MockBase {
    system: string
    settlements: number
    goods: string[]
    production?: string
    blockaded?: boolean
}

export interface MockCard {
    kind: 'Fleet' | 'Genetic'
    name: string
    level: 'I' | 'II' | 'III'
    effect: string
    vp: number
    cost: number
    costField: TechField
}

export interface MockEscalation {
    vp?: number
    text?: string
    benefit?: boolean
}

export interface MockDirective {
    type: string
    text: string
    vp: number
}

export interface MockFaction {
    faction: Faction
    player: string
    you: boolean
    initiative: number
    step: string
    cash: number
    ip: number
    markers: Record<TechField, number[]>
    techs: Record<TechField, number>
    bought: TechField[]
    ships: MockShip[]
    maxShips: number
    bases: MockBase[]
    maxBases: number
    earthGoods: string[]
    hand: MockCard[]
    cards: MockCard[]
    escalation: MockEscalation[]
    canAttack: boolean
    directive?: MockDirective
    fulfilled: MockDirective[]
    goal: { need: number; types: string }
    titles: { name: string; vp: number; effect: string }[]
    keptMarkers: number
    score: number
    rank: string
    abilities: string[]
    settlementCost: number
    production: { cash: number; markers: [number, number, number]; goods: number }
}

export const MOCK_YEAR = 2340
export const TECH_TOTALS: Record<TechField, number> = {
    [TechField.Biology]: TECHS.filter((tech) => tech.field === TechField.Biology).length,
    [TechField.Physics]: TECHS.filter((tech) => tech.field === TechField.Physics).length,
    [TechField.Engineering]: TECHS.filter((tech) => tech.field === TechField.Engineering).length
}

const BASE_TIERS: [number, number, number, number][] = [
    [50, 4, 7, 3],
    [40, 3, 6, 2],
    [30, 3, 5, 2],
    [20, 2, 4, 2],
    [15, 2, 3, 2],
    [10, 2, 2, 1],
    [5, 1, 1, 1],
    [1, 1, 0, 0]
]

export function baseTier(settlements: number): { goods: number; cash: number; tech: number } {
    const [, goods, cash, tech] = BASE_TIERS.find(([from]) => settlements >= from) ?? [1, 1, 0, 0]
    return { goods, cash, tech }
}

function ships(
    faction: Faction,
    list: [
        index: number,
        system: string,
        transit?: number,
        damage?: number,
        settlements?: number,
        goods?: number
    ][]
): MockShip[] {
    const roster = factionShips(faction)
    return list.map(([index, system, transit = 0, damage = 0, settlements = 0, goods = 0]) => ({
        ship: roster[index % roster.length],
        system,
        transit,
        damage,
        settlements,
        goods
    }))
}

const B = TechField.Biology
const P = TechField.Physics
const E = TechField.Engineering

export const MOCK_FACTIONS: MockFaction[] = [
    {
        faction: Faction.Praetorians,
        player: 'Otto',
        you: false,
        initiative: 1,
        step: 'Done',
        cash: 41,
        ip: 3,
        markers: { [B]: [2, 1], [P]: [4, 3, 3], [E]: [5, 4, 2] },
        techs: { [B]: 5, [P]: 8, [E]: 10 },
        bought: [E],
        ships: ships(Faction.Praetorians, [
            [5, 'Sol'],
            [8, 'Alpha Centauri'],
            [9, 'Alpha Centauri', 0, 1],
            [11, 'Luhman 16', 2],
            [0, 'Wolf 359'],
            [13, 'Barnard’s Star']
        ]),
        maxShips: 6,
        bases: [
            {
                system: 'Alpha Centauri',
                settlements: 31,
                goods: ['Machinery', 'Medicine'],
                production: 'Cash'
            },
            { system: 'Wolf 359', settlements: 8, goods: [] }
        ],
        maxBases: 3,
        earthGoods: ['Fine Art', 'Flora'],
        hand: [],
        cards: [
            {
                kind: 'Fleet',
                name: 'Military Academy',
                level: 'III',
                effect: '',
                vp: 7,
                cost: 35,
                costField: E
            },
            {
                kind: 'Fleet',
                name: 'Hypersonic Missiles',
                level: 'I',
                effect: '',
                vp: 2,
                cost: 12,
                costField: P
            }
        ],
        escalation: [
            { vp: 3 },
            { vp: 1 },
            { text: 'Earth Production −$2B Cash' },
            { text: 'Initiative Roll −20%' }
        ],
        canAttack: true,
        fulfilled: [
            { type: 'Combat', text: 'Raid a base of the player with the most settlements', vp: 2 }
        ],
        goal: { need: 4, types: 'anomaly or combat' },
        titles: [
            {
                name: 'Admiral',
                vp: 10,
                effect: '+2 to Combat Rolls; Can’t Raid; Can only attack players who have more escalation'
            }
        ],
        keptMarkers: 1,
        score: 152,
        rank: 'Commander',
        abilities: [
            'Draw an extra fleet improvement card at game start; each additional fleet improvement card per level costs +3 instead of +5',
            '+1 to combat rolls',
            'Your bases can’t be raided'
        ],
        settlementCost: 6,
        production: { cash: 32, markers: [3, 3, 3], goods: 4 }
    },
    {
        faction: Faction.Starfarers,
        player: 'You',
        you: true,
        initiative: 2,
        step: 'Cargo & trade',
        cash: 27,
        ip: 7,
        markers: { [B]: [3, 2], [P]: [5, 4, 2, 2], [E]: [3, 1] },
        techs: { [B]: 6, [P]: 10, [E]: 7 },
        bought: [],
        ships: ships(Faction.Starfarers, [
            [1, 'Tau Ceti'],
            [3, 'Epsilon Eridani', 1],
            [4, 'Sol', 0, 0, 2],
            [6, 'Luhman 16', 0, 1, 0, 2],
            [7, 'Lalande 21185', 3],
            [9, 'Sol']
        ]),
        maxShips: 6,
        bases: [
            {
                system: 'Luhman 16',
                settlements: 23,
                goods: ['Medicine', 'Flora', 'Fauna'],
                production: 'Physics'
            },
            { system: 'Barnard’s Star', settlements: 12, goods: ['Machinery'], production: 'Cash' },
            { system: 'Tau Ceti', settlements: 4, goods: [], blockaded: true }
        ],
        maxBases: 4,
        earthGoods: ['Fine Art', 'Medicine', 'Machinery'],
        hand: [
            {
                kind: 'Fleet',
                name: 'Planetary Surveys',
                level: 'I',
                effect: 'When drawing Worlds for completed surveys, draw two and choose which to use',
                vp: 3,
                cost: 9,
                costField: P
            },
            {
                kind: 'Genetic',
                name: 'Natural Immortality',
                level: 'III',
                effect: 'Settlement growth +2 at all your bases',
                vp: 9,
                cost: 40,
                costField: B
            }
        ],
        cards: [
            {
                kind: 'Fleet',
                name: 'Freight Haulers',
                level: 'II',
                effect: 'Crew Vehicle cargo capacity +1 for ships that carry cargo',
                vp: 1,
                cost: 30,
                costField: E
            }
        ],
        escalation: [{ vp: 2 }, { text: 'Settlements cost +$1B on Earth' }],
        canAttack: true,
        directive: { type: 'Survey', text: 'Complete a Survey at Procyon', vp: 2 },
        fulfilled: [
            { type: 'Anomaly', text: 'Resolve a science anomaly', vp: 3 },
            { type: 'Survey', text: 'Complete a Survey at Wolf 359', vp: 2 }
        ],
        goal: { need: 4, types: 'anomaly or survey' },
        titles: [],
        keptMarkers: 3,
        score: 137,
        rank: 'Lieutenant',
        abilities: [
            'Your bases count as twice their size for extending ship range',
            '+10% chance of finding anomalies (30% instead of 20%)',
            'Reduce the difficulty of anomalies and events by 1'
        ],
        settlementCost: 5,
        production: { cash: 29, markers: [2, 2, 2], goods: 4 }
    },
    {
        faction: Faction.Syndicate,
        player: 'Viktor',
        you: false,
        initiative: 3,
        step: 'Cargo & trade',
        cash: 18,
        ip: 1,
        markers: { [B]: [1], [P]: [3, 2], [E]: [4, 4, 1] },
        techs: { [B]: 4, [P]: 7, [E]: 8 },
        bought: [],
        ships: ships(Faction.Syndicate, [
            [2, 'Sol'],
            [4, 'Barnard’s Star'],
            [6, 'Barnard’s Star'],
            [8, 'Wolf 359', 1],
            [10, 'Sirius', 0, 2]
        ]),
        maxShips: 7,
        bases: [{ system: 'Sirius', settlements: 6, goods: ['Fauna'], production: 'Cash' }],
        maxBases: 3,
        earthGoods: ['Machinery'],
        hand: [],
        cards: [],
        escalation: [
            { vp: 4 },
            { vp: 2 },
            { text: 'You Can’t Attack' },
            { text: 'Earn −$1B per Trade Good Sold' },
            { text: 'Migration Chance −20%' }
        ],
        canAttack: false,
        fulfilled: [],
        goal: { need: 4, types: 'combat or trade' },
        titles: [],
        keptMarkers: 0,
        score: 71,
        rank: 'Scoundrel',
        abilities: [
            'After rolling for raids, you can choose to reduce your roll to a lower result',
            'Reduce difficulty of combat anomalies and combat events by 2',
            'You can steal $1B from players who are mining or researching in a system where you have more ship combat value than they do'
        ],
        settlementCost: 4,
        production: { cash: 26, markers: [2, 2, 3], goods: 4 }
    },
    {
        faction: Faction.Givers,
        player: 'Mara',
        you: false,
        initiative: 4,
        step: 'Build & repair',
        cash: 33,
        ip: 9,
        markers: { [B]: [5, 4, 3, 1], [P]: [2], [E]: [2, 2] },
        techs: { [B]: 11, [P]: 6, [E]: 5 },
        bought: [B],
        ships: ships(Faction.Givers, [
            [0, 'Wise 0855-0714'],
            [2, 'Gliese 876'],
            [6, 'Alpha Centauri', 0, 0, 3],
            [7, 'Procyon', 2],
            [9, 'Sol']
        ]),
        maxShips: 6,
        bases: [
            {
                system: 'Procyon',
                settlements: 17,
                goods: ['Flora', 'Flora'],
                production: 'Biology'
            },
            { system: 'Gliese 876', settlements: 14, goods: ['Medicine'] },
            { system: 'Wise 0855-0714', settlements: 9, goods: [] },
            { system: 'Alpha Centauri', settlements: 5, goods: [] }
        ],
        maxBases: 4,
        earthGoods: ['Flora', 'Fauna', 'Fine Art', 'Medicine'],
        hand: [],
        cards: [
            {
                kind: 'Genetic',
                name: 'Prolific Breeders',
                level: 'I',
                effect: '',
                vp: 2,
                cost: 10,
                costField: B
            },
            {
                kind: 'Genetic',
                name: 'Eager Migrants',
                level: 'II',
                effect: '',
                vp: 2,
                cost: 22,
                costField: B
            }
        ],
        escalation: [],
        canAttack: true,
        fulfilled: [{ type: 'Terraform', text: 'Terraform a World into M-Class', vp: 7 }],
        goal: { need: 2, types: 'terraform' },
        titles: [
            {
                name: 'Planetary Architect',
                vp: 10,
                effect: 'One extra Terraforming action per Terraforming phase'
            }
        ],
        keptMarkers: 2,
        score: 168,
        rank: 'Commander',
        abilities: ['You can perform an extra terraforming action (no tech required)'],
        settlementCost: 4,
        production: { cash: 28, markers: [3, 2, 2], goods: 4 }
    },
    {
        faction: Faction.TruePath,
        player: 'Asha',
        you: false,
        initiative: 5,
        step: 'Build & repair',
        cash: 22,
        ip: 5,
        markers: { [B]: [4, 2], [P]: [1], [E]: [3] },
        techs: { [B]: 9, [P]: 5, [E]: 6 },
        bought: [],
        ships: ships(Faction.TruePath, [
            [1, 'Lalande 21185'],
            [3, 'Epsilon Eridani'],
            [7, 'Sol', 0, 0, 4],
            [10, 'Tau Ceti', 1]
        ]),
        maxShips: 6,
        bases: [
            {
                system: 'Lalande 21185',
                settlements: 52,
                goods: ['Medicine', 'Fine Art', 'Flora', 'Fauna'],
                production: 'Biology'
            },
            { system: 'Epsilon Eridani', settlements: 11, goods: [] }
        ],
        maxBases: 4,
        earthGoods: [],
        hand: [],
        cards: [
            {
                kind: 'Genetic',
                name: 'Pioneers',
                level: 'I',
                effect: '',
                vp: 1,
                cost: 8,
                costField: B
            }
        ],
        escalation: [{ text: 'Earth Production +1 Eng. Marker', benefit: true }],
        canAttack: true,
        fulfilled: [{ type: 'Production', text: 'Earn $7B from base production', vp: 2 }],
        goal: { need: 3, types: 'production or terraform' },
        titles: [],
        keptMarkers: 0,
        score: 144,
        rank: 'Lieutenant',
        abilities: [
            'After settlement growth, in one system where you and another player both have bases, you can roll a die. On a 4 or less, you convert one of that player’s settlements into your own',
            'You treat all system habitability as +20% (max 100%)'
        ],
        settlementCost: 3,
        production: { cash: 27, markers: [3, 2, 2], goods: 3 }
    },
    {
        faction: Faction.Consortium,
        player: 'Lena',
        you: false,
        initiative: 6,
        step: 'Build & repair',
        cash: 58,
        ip: 4,
        markers: { [B]: [2], [P]: [3, 3], [E]: [5, 5, 3, 2] },
        techs: { [B]: 5, [P]: 7, [E]: 11 },
        bought: [],
        ships: ships(Faction.Consortium, [
            [0, 'Luhman 16'],
            [2, 'Barnard’s Star'],
            [5, 'Sol', 0, 0, 0, 3],
            [8, 'Wolf 359', 0, 0, 0, 2],
            [11, 'Sol'],
            [13, 'Lalande 21185', 2]
        ]),
        maxShips: 6,
        bases: [
            {
                system: 'Wolf 359',
                settlements: 19,
                goods: ['Machinery', 'Machinery'],
                production: 'Cash'
            },
            { system: 'Luhman 16', settlements: 15, goods: ['Fine Art'] },
            { system: 'Barnard’s Star', settlements: 3, goods: [] }
        ],
        maxBases: 3,
        earthGoods: ['Machinery', 'Machinery', 'Fine Art', 'Fauna', 'Medicine', 'Flora'],
        hand: [],
        cards: [
            {
                kind: 'Fleet',
                name: 'Traders Guild',
                level: 'II',
                effect: '',
                vp: 4,
                cost: 25,
                costField: E
            }
        ],
        escalation: [],
        canAttack: true,
        fulfilled: [
            { type: 'Trade', text: 'Sell 3 goods in one system', vp: 3 },
            { type: 'Production', text: 'Earn $9B from base production', vp: 3 }
        ],
        goal: { need: 4, types: 'production or trade' },
        titles: [{ name: 'Guildmaster', vp: 10, effect: '' }],
        keptMarkers: 1,
        score: 159,
        rank: 'Commander',
        abilities: [
            'You can sell trade goods in systems with other player bases without paying them',
            'When you draw demand markers, draw 3 instead of 2 to choose from'
        ],
        settlementCost: 5,
        production: { cash: 30, markers: [2, 3, 3], goods: 5 }
    }
]

function variantFromUrl(): PlayerVariantKey | undefined {
    if (typeof window === 'undefined') return undefined
    const value = new URL(window.location.href).searchParams.get('players')
    return PLAYER_VARIANTS.find((variant) => variant.key === value)?.key
}

class PlayerAreaPrototype {
    variant: PlayerVariantKey | undefined = $state(variantFromUrl())
    selected: Faction = $state(Faction.Starfarers)
    sheetOpen = $state(false)
    wide = new MediaQuery('(min-width: 64rem)')

    get sheetUnderMap(): boolean {
        return this.variant === 'C' || (this.variant === 'D' && this.wide.current)
    }

    get you(): MockFaction {
        return MOCK_FACTIONS.find((faction) => faction.you) ?? MOCK_FACTIONS[0]
    }

    get selectedFaction(): MockFaction {
        return MOCK_FACTIONS.find((faction) => faction.faction === this.selected) ?? this.you
    }

    setVariant(key: PlayerVariantKey) {
        this.variant = key
        const url = new URL(window.location.href)
        url.searchParams.set('players', key)
        window.history.replaceState(window.history.state, '', url)
    }
}

export const playerArea = new PlayerAreaPrototype()

export function sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0)
}

export function totalSettlements(faction: MockFaction): number {
    return sum(faction.bases.map((base) => base.settlements))
}

const LIGHT_FILLS: readonly Faction[] = [Faction.Consortium, Faction.TruePath, Faction.Givers]
export function inkOn(faction: Faction): string {
    return LIGHT_FILLS.includes(faction) ? '#0c1018' : '#eef2f8'
}

export const GOODS_COLORS: Record<string, string> = {
    'Fine Art': '#c9b3d9',
    Medicine: '#e9a39a',
    Machinery: '#c9cfc0',
    Flora: '#a7c98a',
    Fauna: '#d9c08a'
}
