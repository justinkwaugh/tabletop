/** R-2.1 Epochs I to V by number; V is never played, reaching it ends the game (R-6.1). */
export type Epoch = 1 | 2 | 3 | 4 | 5

/** R-6.1 Its dawn is the last thing before final scoring. */
export const LastEpoch = 5

/** R-1.2.1 The letters printed on the map's spaces. */
export type MapDirection = 'N' | 'S' | 'E' | 'W'

export interface EpicVoyageSpace {
    readonly id: `track.voyage.${number}`
    readonly space: number
    readonly section: number
    /** R-6.2 The furthest-on disc in the section, and any tied with it, score the higher value. */
    readonly vp: { readonly lower: number; readonly higher: number }
    /** R-3.7.5 The writ icon. */
    readonly writDraw: { readonly draw: number; readonly keep: number } | null
    readonly monastery: boolean
}

const VoyageWritDraw = { draw: 2, keep: 1 }

/** R-3.7.5, R-6.2 In track order. */
export const EpicVoyageTrack: readonly EpicVoyageSpace[] = [
    {
        id: 'track.voyage.1',
        space: 1,
        section: 1,
        vp: { lower: 3, higher: 5 },
        writDraw: null,
        monastery: false
    },
    {
        id: 'track.voyage.2',
        space: 2,
        section: 1,
        vp: { lower: 3, higher: 5 },
        writDraw: VoyageWritDraw,
        monastery: false
    },
    {
        id: 'track.voyage.3',
        space: 3,
        section: 2,
        vp: { lower: 7, higher: 9 },
        writDraw: null,
        monastery: false
    },
    {
        id: 'track.voyage.4',
        space: 4,
        section: 2,
        vp: { lower: 7, higher: 9 },
        writDraw: VoyageWritDraw,
        monastery: false
    },
    {
        id: 'track.voyage.5',
        space: 5,
        section: 3,
        vp: { lower: 11, higher: 13 },
        writDraw: null,
        monastery: false
    },
    {
        id: 'track.voyage.6',
        space: 6,
        section: 3,
        vp: { lower: 11, higher: 13 },
        writDraw: VoyageWritDraw,
        monastery: false
    },
    {
        id: 'track.voyage.7',
        space: 7,
        section: 4,
        vp: { lower: 17, higher: 17 },
        writDraw: null,
        monastery: true
    }
]

export interface MilitaryServiceSpace {
    readonly id: `track.military.${number}`
    readonly space: number
    /** R-4.9.2 What a vassal loses at each dawn this space is due and uncovered. */
    readonly penalty: number
    /** R-4.9.2 The first dawn the space is due; it stays due at every later disloyalty dawn. */
    readonly dueFrom: Epoch
}

/** R-4.9.2 In the order discs cover them. */
export const MilitaryServiceTrack: readonly MilitaryServiceSpace[] = [
    { id: 'track.military.1', space: 1, penalty: -3, dueFrom: 2 },
    { id: 'track.military.2', space: 2, penalty: -4, dueFrom: 4 },
    { id: 'track.military.3', space: 3, penalty: -5, dueFrom: 5 }
]

export type VoyageSpaceId = EpicVoyageSpace['id']
export type MilitarySpaceId = MilitaryServiceSpace['id']

/** R-4.11.2 What the stack tops must show for the epoch to be triggered. */
export type EpochAdvance =
    | { readonly kind: 'start' }
    | { readonly kind: 'stack-tops'; readonly tileEpoch: Epoch; readonly count: number }
    | { readonly kind: 'empty-stacks'; readonly count: number }

export interface Sunray {
    readonly id: string
    readonly epoch: Epoch
    readonly ray: string
    /** R-4.12.4 Where one random good lands in each region; epoch I's N is setup's (R-1.4.6). */
    readonly mapDirection: MapDirection | null
    /** R-4.12.2 The catapult icon. */
    readonly disloyalty: boolean
    /** R-4.12.5 */
    readonly guildRefill: boolean
    readonly advanceWhen: EpochAdvance
}

/** R-4.11, R-4.12 */
export const EpochTrack: readonly Sunray[] = [
    {
        id: 'track.epoch.i',
        epoch: 1,
        ray: 'I',
        mapDirection: 'N',
        disloyalty: false,
        guildRefill: false,
        advanceWhen: { kind: 'start' }
    },
    {
        id: 'track.epoch.ii',
        epoch: 2,
        ray: 'II',
        mapDirection: 'S',
        disloyalty: true,
        guildRefill: false,
        advanceWhen: { kind: 'stack-tops', tileEpoch: 2, count: 4 }
    },
    {
        id: 'track.epoch.iii',
        epoch: 3,
        ray: 'III',
        mapDirection: 'E',
        disloyalty: false,
        guildRefill: true,
        advanceWhen: { kind: 'stack-tops', tileEpoch: 3, count: 3 }
    },
    {
        id: 'track.epoch.iv',
        epoch: 4,
        ray: 'IV',
        mapDirection: 'W',
        disloyalty: true,
        guildRefill: false,
        advanceWhen: { kind: 'stack-tops', tileEpoch: 4, count: 2 }
    },
    {
        id: 'track.epoch.v',
        epoch: 5,
        ray: 'V',
        mapDirection: null,
        disloyalty: true,
        guildRefill: false,
        advanceWhen: { kind: 'empty-stacks', count: 1 }
    }
]

/** R-4.12.2 */
export const DisloyaltyDawns: readonly Epoch[] = EpochTrack.filter((ray) => ray.disloyalty).map(
    (ray) => ray.epoch
)

export interface RegionTileChartRow {
    readonly id: string
    readonly tileEpoch: Epoch
    /** R-4.3.2 The vp for a legal tile, by the location improved; V is printed crossed out. */
    readonly vp: { readonly farm: number; readonly town: number; readonly feudum: number } | null
}

/** R-4.3.2 */
export const RegionTileChart: readonly RegionTileChartRow[] = [
    { id: 'track.tile-chart.i', tileEpoch: 1, vp: { farm: 2, town: 3, feudum: 4 } },
    { id: 'track.tile-chart.ii', tileEpoch: 2, vp: { farm: 3, town: 4, feudum: 5 } },
    { id: 'track.tile-chart.iii', tileEpoch: 3, vp: { farm: 4, town: 5, feudum: 6 } },
    { id: 'track.tile-chart.iv', tileEpoch: 4, vp: { farm: 5, town: 6, feudum: 7 } },
    { id: 'track.tile-chart.v', tileEpoch: 5, vp: null }
]

/** R-1.2.5 */
export const ScoreTrack = {
    id: 'track.score',
    lowest: 0,
    highest: 149,
    spaces: 150,
    labelEvery: 5
} as const
