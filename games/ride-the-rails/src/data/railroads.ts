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
    | 'any-city-but-long-distance'
    | 'printed-colour'
    | 'printed-colour-or-berlin'

export type RailroadIntroduction = {
    readonly railroadId: RailroadId
    readonly availableFromRound: number
    readonly startRule: StartRule
}

// R-1.4, R-8: on every expansion map the railroads arrive in the USA's rounds. Each starts in a
// city printed in its colour, Black in any city with room (R-4.2.5), but on Australia (below).
const PRINTED_COLOUR_INTRODUCTIONS: readonly RailroadIntroduction[] = [
    { railroadId: 'railroad.red', availableFromRound: 1, startRule: 'printed-colour' },
    { railroadId: 'railroad.blue', availableFromRound: 1, startRule: 'printed-colour' },
    { railroadId: 'railroad.orange', availableFromRound: 2, startRule: 'printed-colour' },
    { railroadId: 'railroad.yellow', availableFromRound: 3, startRule: 'printed-colour' },
    { railroadId: 'railroad.purple', availableFromRound: 4, startRule: 'printed-colour' },
    { railroadId: 'railroad.black', availableFromRound: 5, startRule: 'any-city' }
]

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
    ],
    // R-8.2: the USA's rounds; each railroad starts in a city printed in its colour, Black in any
    // city with room but Perth and Brisbane, the long-distance cities, where no railroad starts.
    'map.au': [
        { railroadId: 'railroad.red', availableFromRound: 1, startRule: 'printed-colour' },
        { railroadId: 'railroad.blue', availableFromRound: 1, startRule: 'printed-colour' },
        { railroadId: 'railroad.orange', availableFromRound: 2, startRule: 'printed-colour' },
        { railroadId: 'railroad.yellow', availableFromRound: 3, startRule: 'printed-colour' },
        { railroadId: 'railroad.purple', availableFromRound: 4, startRule: 'printed-colour' },
        {
            railroadId: 'railroad.black',
            availableFromRound: 5,
            startRule: 'any-city-but-long-distance'
        }
    ],
    // R-8.3: as on Australia.
    'map.ca': PRINTED_COLOUR_INTRODUCTIONS,
    // R-8.4: as on Australia. Red and Blue start in the Red/Blue/Black cities, each holding one, so
    // never in the same one.
    'map.fr': PRINTED_COLOUR_INTRODUCTIONS,
    // R-8.5: as on Australia, but Purple may also start in Berlin.
    'map.de': [
        { railroadId: 'railroad.red', availableFromRound: 1, startRule: 'printed-colour' },
        { railroadId: 'railroad.blue', availableFromRound: 1, startRule: 'printed-colour' },
        { railroadId: 'railroad.orange', availableFromRound: 2, startRule: 'printed-colour' },
        { railroadId: 'railroad.yellow', availableFromRound: 3, startRule: 'printed-colour' },
        {
            railroadId: 'railroad.purple',
            availableFromRound: 4,
            startRule: 'printed-colour-or-berlin'
        },
        { railroadId: 'railroad.black', availableFromRound: 5, startRule: 'any-city' }
    ]
}
