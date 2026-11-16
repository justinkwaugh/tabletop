import { assertExists } from '@tabletop/common'
import {
    ScotlandNorthOverlay1822,
    ScotlandSouthOverlay1822,
    SouthWalesOverlay1822,
    SouthwestOverlay1822,
    type ScenarioOverlay1822
} from './overlays.js'
import { Bank1822, CertificateLimits1822, StartingCash1822 } from './setup.js'
import {
    ScenarioCatalog1822,
    type ScenarioEntry1822,
    type ScenarioId1822
} from './scenarioCatalog.js'

// The scenarios of the designer's print-and-play pack, "1822 Scenario Rules" version 1.0 of
// 15 July 2016 (sheets General, Cash and Shares, Train Mix, Tile Manifest) with its overlays of
// 16 July 2016. Rulebook §6.2.1 names them. The sheets are cited below by name.

/** The major companies by the group a full-map scenario removes at most one of (General sheet). */
export const MajorRemovalGroups1822 = {
    london: ['LNWR', 'GWR', 'LBSCR', 'SECR'],
    middle: ['MR', 'LYR', 'SWR'],
    north: ['NBR', 'NER', 'CR']
} as const

/**
 * Which major companies a game plays without: those named, or so many taken at random from the
 * groups given, never two from one group (General sheet).
 */
export type MajorRemoval1822 =
    { removedIds: readonly string[] } | { groups: readonly (readonly string[])[]; count: number }

/** A mix of yellow tiles and upgrades a company may lay in one turn. */
export type TurnLays1822 = { yellow: number; upgrades: number }

/** What a game is set up and played with: the standard game's terms, or a scenario's. */
export type Setup1822 = {
    /** Start money by number of players (Table 1; Cash and Shares sheet). */
    startingCash: Readonly<Record<number, number>>
    bank: number
    /** The share value that ends the game (§1.3.1; overlay, Game End Spaces). */
    endPrice: number
    certificateLimits: Readonly<Record<number, number>>
    /** How many of each train the bank holds (Table 7; Train Mix sheet). */
    trains: Readonly<Record<string, number>>
    /** What a minor company's first-turn L train costs less than its price (Train Mix sheet). */
    firstTrainDiscount: number
    /** What flipping an L train to a 2-train costs, by the phase it is done in (§5.15.4). */
    localUpgradePrices: Readonly<Record<string, number>>
    /** The private companies used: the first so many, or all but so many removed at random. */
    privates: { through: number } | { removed: number }
    /** The minor companies removed: those named, or so many at random, never the Metropolitan. */
    minors: { removedIds: readonly string[] } | { removed: number }
    /** The minor company in the first box as the game begins (§2.1.5). */
    firstMinorId: string
    majors: MajorRemoval1822
    /** The tiles a major company may lay in a turn, before phase 3 and from it (§5.8.13). */
    majorLays: { early: readonly TurnLays1822[]; later: readonly TurnLays1822[] }
    /** The Metropolitan Railway may take the station space of a removed London major. */
    metropolitanTakesLondonHome?: true
    overlays: readonly ScenarioOverlay1822[]
    /** How many of each tile the game plays without, by tile definition (Tile Manifest sheet). */
    tilesRemoved: Readonly<Record<string, number>>
}

export type Scenario1822 = Setup1822 & ScenarioEntry1822

const byPlayers = (three: number, four: number, five: number, six: number, seven: number) => ({
    3: three,
    4: four,
    5: five,
    6: six,
    7: seven
})

const LargeCash = byPlayers(600, 450, 360, 300, 260)
const MediumCash = byPlayers(500, 375, 300, 250, 215)
const SmallCash = byPlayers(400, 300, 240, 200, 175)

const trains = (local: number, three: number, four: number, five: number, six: number) => ({
    L: local,
    '3': three,
    '4': four,
    '5': five,
    '6': six
})

const lays = (yellow: number, upgrades: number): TurnLays1822 => ({ yellow, upgrades })
// Before phase 3 the only upgrade is the one P11 brings early (§3.1.13).
const StandardLays = { early: [lays(1, 0), lays(0, 1)], later: [lays(2, 0), lays(0, 1)] }
const TwoTileLays = { early: [lays(2, 0), lays(0, 1)], later: [lays(2, 0), lays(1, 1)] }
const ThreeTileLays = {
    early: [lays(2, 0), lays(0, 1)],
    later: [lays(3, 0), lays(2, 1), lays(1, 2)]
}

const StandardUpgrade = { '1': 80, '2': 80 }
const UpgradeLowerFromPhase2 = { '1': 80, '2': 70 }
const LowerUpgrade = { '1': 70, '2': 70 }
const ScenarioFirstTrainDiscount = 10

const NorthernMinorIds = ['M1', 'M2', 'M3']
const MiddleMinorIds = [...NorthernMinorIds, 'M4', 'M5', 'M6', 'M22', 'M23']
const SmallMinorIds = [...MiddleMinorIds, 'M19', 'M20', 'M21', 'M24']
const { london, middle, north } = MajorRemovalGroups1822
const RemovalGroups = [london, middle, north]

// Tiles the regional scenarios play without (Tile Manifest sheet): the sheet's numbers 145, 146
// and 147 are this set's 767, 768 and 769, and its X numbers the labelled cities' tiles.
const LargeTiles = { '1822:207': 1, '1822:622': 1, '1822:X5': 1 }
const MediumTiles = {
    ...LargeTiles,
    '18xx:3': 1,
    '18xx:4': 1,
    '18xx:5': 1,
    '18xx:6': 2,
    '18xx:57': 1,
    '18xx:58': 1,
    '18xx:14': 1,
    '18xx:15': 1,
    '18xx:80': 1,
    '18xx:81': 1,
    '18xx:82': 2,
    '18xx:83': 2,
    '18xx:141': 1,
    '18xx:142': 1,
    '18xx:143': 1,
    '18xx:144': 1,
    '1822:405': 1,
    '18xx:619': 1,
    '18xx:63': 2,
    '18xx:767': 1,
    '1822:768': 1,
    '18xx:769': 2,
    '18xx:611': 1,
    '1822:X10': 1
}
// Cardiff's and Swansea's own tiles go with South Wales.
const SmallTiles = {
    ...MediumTiles,
    '1822:X1': 1,
    '1822:X3': 1,
    '1822:X6': 1,
    '1822:X8': 1,
    '1822:X12': 1,
    '1822:X14': 1
}

/** The standard game (§2.1, Tables 1 and 7). */
export const StandardSetup1822: Setup1822 = {
    startingCash: StartingCash1822,
    bank: Bank1822,
    endPrice: 700,
    certificateLimits: CertificateLimits1822,
    trains: trains(22, 9, 6, 3, 3),
    firstTrainDiscount: 0,
    localUpgradePrices: StandardUpgrade,
    privates: { through: 18 },
    minors: { removedIds: [] },
    firstMinorId: 'M24',
    majors: { removedIds: [] },
    majorLays: StandardLays,
    overlays: [],
    tilesRemoved: {}
}

const ScenarioSetups: Readonly<Record<ScenarioId1822, Setup1822>> = {
    'large-regional': {
        startingCash: LargeCash,
        bank: 12_000,
        endPrice: 500,
        certificateLimits: byPlayers(18, 14, 11, 9, 8),
        trains: trains(18, 7, 5, 2, 3),
        firstTrainDiscount: ScenarioFirstTrainDiscount,
        localUpgradePrices: StandardUpgrade,
        privates: { through: 15 },
        minors: { removedIds: NorthernMinorIds },
        firstMinorId: 'M24',
        majors: { removedIds: north },
        majorLays: StandardLays,
        overlays: [ScotlandNorthOverlay1822],
        tilesRemoved: LargeTiles
    },
    'medium-regional': {
        startingCash: MediumCash,
        bank: 12_000,
        endPrice: 500,
        certificateLimits: byPlayers(18, 14, 11, 9, 8),
        trains: trains(14, 7, 4, 2, 3),
        firstTrainDiscount: ScenarioFirstTrainDiscount,
        localUpgradePrices: UpgradeLowerFromPhase2,
        privates: { through: 12 },
        minors: { removedIds: MiddleMinorIds },
        firstMinorId: 'M14',
        majors: { removedIds: north },
        majorLays: StandardLays,
        overlays: [ScotlandSouthOverlay1822, SouthwestOverlay1822],
        tilesRemoved: MediumTiles
    },
    'small-regional': {
        startingCash: SmallCash,
        bank: 9000,
        endPrice: 400,
        certificateLimits: byPlayers(16, 13, 10, 8, 7),
        trains: trains(10, 6, 4, 2, 2),
        firstTrainDiscount: ScenarioFirstTrainDiscount,
        localUpgradePrices: LowerUpgrade,
        privates: { through: 12 },
        minors: { removedIds: SmallMinorIds },
        firstMinorId: 'M14',
        majors: { removedIds: [...north, 'SWR'] },
        majorLays: StandardLays,
        overlays: [ScotlandSouthOverlay1822, SouthwestOverlay1822, SouthWalesOverlay1822],
        tilesRemoved: SmallTiles
    },
    'medium-game': {
        startingCash: LargeCash,
        bank: 12_000,
        endPrice: 550,
        certificateLimits: byPlayers(23, 18, 14, 12, 10),
        trains: trains(18, 8, 5, 2, 3),
        firstTrainDiscount: ScenarioFirstTrainDiscount,
        localUpgradePrices: StandardUpgrade,
        privates: { removed: 3 },
        minors: { removed: 4 },
        firstMinorId: 'M14',
        // The four London companies stay; one of the other six goes.
        majors: { groups: [[...middle, ...north]], count: 1 },
        majorLays: TwoTileLays,
        overlays: [],
        tilesRemoved: {}
    },
    'short-game': {
        startingCash: MediumCash,
        bank: 12_000,
        endPrice: 500,
        certificateLimits: byPlayers(20, 15, 12, 10, 9),
        trains: trains(14, 7, 4, 2, 2),
        firstTrainDiscount: ScenarioFirstTrainDiscount,
        localUpgradePrices: UpgradeLowerFromPhase2,
        privates: { removed: 6 },
        minors: { removed: 8 },
        firstMinorId: 'M14',
        majors: { groups: RemovalGroups, count: 2 },
        majorLays: TwoTileLays,
        metropolitanTakesLondonHome: true,
        overlays: [],
        tilesRemoved: {}
    },
    'mini-game': {
        startingCash: SmallCash,
        bank: 9000,
        endPrice: 450,
        certificateLimits: byPlayers(17, 13, 11, 9, 8),
        trains: trains(10, 6, 4, 2, 2),
        firstTrainDiscount: ScenarioFirstTrainDiscount,
        localUpgradePrices: LowerUpgrade,
        privates: { removed: 9 },
        minors: { removed: 12 },
        firstMinorId: 'M14',
        majors: { groups: RemovalGroups, count: 3 },
        majorLays: ThreeTileLays,
        metropolitanTakesLondonHome: true,
        overlays: [],
        tilesRemoved: {}
    }
}

/** The pack's scenarios, each as its players are told of it with its setup. */
export const Scenarios1822: readonly Scenario1822[] = ScenarioCatalog1822.map((entry) => ({
    ...entry,
    ...ScenarioSetups[entry.id]
}))

/** The scenario of that name, where a game plays one. */
export function scenario1822(id: ScenarioId1822 | undefined): Scenario1822 | undefined {
    if (!id) return undefined
    const scenario = Scenarios1822.find((entry) => entry.id === id)
    assertExists(scenario, `Scenario ${id} is one of the pack's`)
    return scenario
}

/** What a game is played with: its scenario's terms, or the standard game's. */
export function setupOf1822(state: { variants: { scenario?: ScenarioId1822 } }): Setup1822 {
    return scenario1822(state.variants.scenario) ?? StandardSetup1822
}
