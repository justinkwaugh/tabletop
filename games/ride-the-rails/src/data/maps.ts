import * as Type from 'typebox'

// R-8: the USA, Australia and Canada; 'map.fr' and 'map.de' are reserved for the other maps.
export const MAP_IDS = ['map.usa', 'map.au', 'map.ca'] as const

export const MapId = Type.Enum(MAP_IDS)
export type MapId = Type.Static<typeof MapId>

// The key a map's hex and city ids carry, `hex.<key>.…` and `city.<key>.…`; one per map id.
export const MAP_KEYS = ['usa', 'au', 'ca'] as const

export type MapKey = (typeof MAP_KEYS)[number]

export const MAP_KEY_OF: Readonly<Record<MapId, MapKey>> = {
    'map.usa': 'usa',
    'map.au': 'au',
    'map.ca': 'ca'
}

export type MapDetails = {
    readonly name: string
    // What the map changes, one line under the creation form's map choice.
    readonly description: string
}

// R-8: each map's name and what it changes, as the creation form lists them. This module holds
// no map data, so the title's metadata can name the maps without loading them.
export const MAP_DETAILS: Readonly<Record<MapId, MapDetails>> = {
    'map.usa': { name: 'USA', description: 'The base game’s map.' },
    'map.au': {
        name: 'Australia',
        description:
            'The Alps take no track; long-distance hexes hold one locomotive and end the turn; Perth $50, Brisbane $20.'
    },
    'map.ca': {
        name: 'Canada',
        description:
            'No mountains; impassable sides block track; Toronto has no limit, $3 a placement and $2 a start; the Intercolonial pays $8.'
    }
}
