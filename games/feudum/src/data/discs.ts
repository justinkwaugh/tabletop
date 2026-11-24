import { PawnFaces, type GuildId } from './components.js'

/** R-3.9.1 The kinds of location, in the order improving moves through them. */
export const LocationKinds = ['outpost', 'farm', 'town', 'feudum'] as const
export type LocationKind = (typeof LocationKinds)[number]

export type DiscFace = 'a' | 'b'

/** R-1.4.3 One of the discs placed on the map at setup; only its front shows a location. */
export interface StartingDisc {
    readonly id: `disc.start.${number}`
    readonly kind: Exclude<LocationKind, 'feudum'>
    readonly circleMark: boolean
}

/** R-3.9.1 A disc of the general supply, a location on each face. */
export interface DoubleSidedDisc {
    readonly id: `disc.double.${number}`
    readonly faces: Readonly<Record<DiscFace, Exclude<LocationKind, 'feudum'>>>
}

/** R-1.2.4, R-3.9.1 A feudum of the general supply, its guild's icon on both faces. */
export interface FeudumDisc {
    readonly id: `disc.feudum.${GuildId}-${1 | 2}`
    readonly guild: GuildId
    readonly icon: string
    readonly faces: Readonly<Record<DiscFace, 'feudum'>>
}

export type LocationDisc = StartingDisc | DoubleSidedDisc | FeudumDisc
export type DiscId = LocationDisc['id']

const CircleMarkedKinds: readonly StartingDisc['kind'][] = [
    'farm',
    'farm',
    'town',
    'town',
    'outpost',
    'outpost'
]

const PlainBackKinds: readonly StartingDisc['kind'][] = [
    'farm',
    'farm',
    'farm',
    'farm',
    'farm',
    'town',
    'town',
    'town',
    'outpost',
    'outpost',
    'outpost',
    'outpost',
    'outpost',
    'outpost',
    'outpost',
    'outpost'
]

/** R-1.4.3 Numbered circle-marked first, each group by farm, town, outpost. Ids are permanent. */
export const StartingDiscs: readonly StartingDisc[] = [
    ...CircleMarkedKinds.map((kind) => ({ kind, circleMark: true })),
    ...PlainBackKinds.map((kind) => ({ kind, circleMark: false }))
].map((disc, index): StartingDisc => ({
    id: `disc.start.${index + 1}`,
    ...disc
}))

const DoubleSidedFaces: readonly DoubleSidedDisc['faces'][] = [
    ...Array.from({ length: 8 }, (): DoubleSidedDisc['faces'] => ({ a: 'farm', b: 'town' })),
    { a: 'outpost', b: 'farm' },
    { a: 'outpost', b: 'town' }
]

/** R-3.9.1 Ids are permanent. */
export const DoubleSidedDiscs: readonly DoubleSidedDisc[] = DoubleSidedFaces.map(
    (faces, index): DoubleSidedDisc => ({ id: `disc.double.${index + 1}`, faces })
)

const FeudumsPerGuild = [1, 2] as const

/** R-1.2.4 Two per guild. Ids are permanent. */
export const FeudumDiscs: readonly FeudumDisc[] = PawnFaces.flatMap(({ character, icon }) =>
    FeudumsPerGuild.map((copy): FeudumDisc => ({
        id: `disc.feudum.${character}-${copy}`,
        guild: character,
        icon,
        faces: { a: 'feudum', b: 'feudum' }
    }))
)

/** R-1.4.3 */
export const LocationDiscs: readonly LocationDisc[] = [
    ...StartingDiscs,
    ...DoubleSidedDiscs,
    ...FeudumDiscs
]

/** R-1.4.3 */
export const LocationDiscTotals = {
    discs: LocationDiscs.length,
    starting: StartingDiscs.length,
    circleMarks: StartingDiscs.filter((disc) => disc.circleMark).length,
    doubleSided: DoubleSidedDiscs.length,
    feudums: FeudumDiscs.length,
    generalSupply: DoubleSidedDiscs.length + FeudumDiscs.length
} as const
