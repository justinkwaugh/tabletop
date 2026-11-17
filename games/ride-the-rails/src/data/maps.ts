import * as Type from 'typebox'

// Reserved for the expansion maps (R-8): 'map.au', 'map.ca', 'map.fr', 'map.de'.
export const MAP_IDS = ['map.usa'] as const

export const MapId = Type.Enum(MAP_IDS)
export type MapId = Type.Static<typeof MapId>

// The key a map's hex and city ids carry, `hex.<key>.…` and `city.<key>.…`; one per map id.
export const MAP_KEYS = ['usa'] as const

export type MapKey = (typeof MAP_KEYS)[number]

export const MAP_KEY_OF: Readonly<Record<MapId, MapKey>> = {
    'map.usa': 'usa'
}

export type MapDetails = {
    readonly name: string
    // What the map changes, one line under the creation form's map choice.
    readonly description: string
}

// R-8: each map's name and what it changes, as the creation form lists them. This module holds
// no map data, so the title's metadata can name the maps without loading them.
export const MAP_DETAILS: Readonly<Record<MapId, MapDetails>> = {
    'map.usa': { name: 'USA', description: 'The base game’s map.' }
}
