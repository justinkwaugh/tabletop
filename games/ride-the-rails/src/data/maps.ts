import * as Type from 'typebox'

// R-8: the USA and the four expansion maps.
export const MAP_IDS = ['map.usa', 'map.au', 'map.ca', 'map.fr', 'map.de'] as const

export const MapId = Type.Enum(MAP_IDS)
export type MapId = Type.Static<typeof MapId>

// The key a map's hex and city ids carry, `hex.<key>.…` and `city.<key>.…`; one per map id.
export const MAP_KEYS = ['usa', 'au', 'ca', 'fr', 'de'] as const

export type MapKey = (typeof MAP_KEYS)[number]

export const MAP_KEY_OF: Readonly<Record<MapId, MapKey>> = {
    'map.usa': 'usa',
    'map.au': 'au',
    'map.ca': 'ca',
    'map.fr': 'fr',
    'map.de': 'de'
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
    },
    'map.fr': {
        name: 'France',
        description:
            'Paris $10 inside a ring of six one-locomotive entry hexes, and a new passenger there each round it has none; estuaries that track cannot cross.'
    },
    'map.de': {
        name: 'Germany',
        description:
            'Berlin spans two hexes with no limit, $3 a placement, and Purple may start there; Orange pays no mountain cost; Greater Germany pays $12.'
    }
}
