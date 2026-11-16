import { assertExists } from '@tabletop/common'
import { BERLIN } from './map.js'

export enum RailroadId {
    Ostbahn = 'Ostbahn',
    Niederschlesische = 'Niederschlesische',
    Saechsische = 'Saechsische',
    Bayerische = 'Bayerische',
    MainWeser = 'MainWeser',
    Badische = 'Badische',
    KolnMindener = 'KolnMindener',
    BerlinHamburger = 'BerlinHamburger'
}

export enum Ability {
    FourTrack = 'FourTrack',
    NoCityPenalty = 'NoCityPenalty',
    TwoTrack = 'TwoTrack',
    CheaperTrack = 'CheaperTrack',
    DoubleCity = 'DoubleCity',
    FreeRural = 'FreeRural',
    FiveDollarMax = 'FiveDollarMax',
    MustConnect = 'MustConnect'
}

export type RailroadDefinition = {
    id: RailroadId
    name: string
    year: number
    homeSpaceId: string
    track: number
    ability: Ability
}

export const SHARES_PER_RAILROAD = 3
export const STANDARD_TRACK_PER_EXPANSION = 3
export const KOLN_MINDENER_SPENDING_LIMIT = 5
export const BERLIN_HAMBURGER_TERMINI: readonly string[] = [BERLIN, 'hamburg']

export const RAILROADS: readonly RailroadDefinition[] = [
    {
        id: RailroadId.Ostbahn,
        name: 'Preußische Ostbahn',
        year: 1852,
        homeSpaceId: 'konigsberg',
        track: 20,
        ability: Ability.FourTrack
    },
    {
        id: RailroadId.Niederschlesische,
        name: 'Niederschlesische',
        year: 1847,
        homeSpaceId: 'breslau',
        track: 17,
        ability: Ability.NoCityPenalty
    },
    {
        id: RailroadId.Saechsische,
        name: 'Sächsische',
        year: 1842,
        homeSpaceId: 'leipzig',
        track: 11,
        ability: Ability.TwoTrack
    },
    {
        id: RailroadId.Bayerische,
        name: 'Bayerische',
        year: 1852,
        homeSpaceId: 'munchen',
        track: 16,
        ability: Ability.CheaperTrack
    },
    {
        id: RailroadId.MainWeser,
        name: 'Main-Weser',
        year: 1849,
        homeSpaceId: 'kassel',
        track: 14,
        ability: Ability.DoubleCity
    },
    {
        id: RailroadId.Badische,
        name: 'Badische',
        year: 1852,
        homeSpaceId: 'mannheim',
        track: 15,
        ability: Ability.FreeRural
    },
    {
        id: RailroadId.KolnMindener,
        name: 'Köln-Mindener',
        year: 1849,
        homeSpaceId: 'essen',
        track: 12,
        ability: Ability.FiveDollarMax
    },
    {
        id: RailroadId.BerlinHamburger,
        name: 'Berlin-Hamburger',
        year: 1842,
        homeSpaceId: 'wittenberge',
        track: 13,
        ability: Ability.MustConnect
    }
]

export const RAILROAD_IDS: readonly RailroadId[] = RAILROADS.map((railroad) => railroad.id)

export const OPENING_AUCTION_ORDER: readonly RailroadId[] = RAILROAD_IDS

export function railroadDefinition(id: RailroadId): RailroadDefinition {
    const definition = RAILROADS.find((railroad) => railroad.id === id)
    assertExists(definition, `Unknown railroad ${id}`)
    return definition
}

export function maxTrackPerExpansion(id: RailroadId): number {
    switch (railroadDefinition(id).ability) {
        case Ability.FourTrack:
            return 4
        case Ability.TwoTrack:
            return 2
        default:
            return STANDARD_TRACK_PER_EXPANSION
    }
}
