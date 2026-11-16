import * as Type from 'typebox'
import type { MapId } from './maps.js'

export const RAILROAD_IDS = [
    'railroad.red',
    'railroad.blue',
    'railroad.orange',
    'railroad.yellow',
    'railroad.purple',
    'railroad.black'
] as const

export const RailroadId = Type.Enum(RAILROAD_IDS)
export type RailroadId = Type.Static<typeof RailroadId>

export const LOCOMOTIVES_PER_RAILROAD = 27

export type RailroadDefinition = {
    readonly id: RailroadId
    readonly printedName: string
    readonly locomotives: number
}

// R-1.1: 27 locomotives of each colour; R-1.4 order (Red, Blue, Orange, Yellow, Purple, Black).
export const RAILROADS: readonly RailroadDefinition[] = [
    { id: 'railroad.red', printedName: 'Red', locomotives: LOCOMOTIVES_PER_RAILROAD },
    { id: 'railroad.blue', printedName: 'Blue', locomotives: LOCOMOTIVES_PER_RAILROAD },
    { id: 'railroad.orange', printedName: 'Orange', locomotives: LOCOMOTIVES_PER_RAILROAD },
    { id: 'railroad.yellow', printedName: 'Yellow', locomotives: LOCOMOTIVES_PER_RAILROAD },
    { id: 'railroad.purple', printedName: 'Purple', locomotives: LOCOMOTIVES_PER_RAILROAD },
    { id: 'railroad.black', printedName: 'Black', locomotives: LOCOMOTIVES_PER_RAILROAD }
]

export type StartRule =
    | 'east-coast-apart'
    | 'east-coast-or-chicago'
    | 'chicago-or-westernmost'
    | 'west-coast'
    | 'any-city'

export type RailroadIntroduction = {
    readonly railroadId: RailroadId
    readonly availableFromRound: number
    readonly startRule: StartRule
}

// R-1.4 availability and R-4.2.1 to R-4.2.5 starts; R-8: an expansion map adds its own row.
export const RAILROAD_INTRODUCTIONS: Readonly<Record<MapId, readonly RailroadIntroduction[]>> = {
    'map.usa': [
        { railroadId: 'railroad.red', availableFromRound: 1, startRule: 'east-coast-apart' },
        { railroadId: 'railroad.blue', availableFromRound: 1, startRule: 'east-coast-apart' },
        {
            railroadId: 'railroad.orange',
            availableFromRound: 2,
            startRule: 'east-coast-or-chicago'
        },
        {
            railroadId: 'railroad.yellow',
            availableFromRound: 3,
            startRule: 'chicago-or-westernmost'
        },
        { railroadId: 'railroad.purple', availableFromRound: 4, startRule: 'west-coast' },
        { railroadId: 'railroad.black', availableFromRound: 5, startRule: 'any-city' }
    ]
}
