import * as Type from 'typebox'

// Reserved for the expansion maps (R-8): 'map.au', 'map.ca', 'map.fr', 'map.de'.
export const MAP_IDS = ['map.usa'] as const

export const MapId = Type.Enum(MAP_IDS)
export type MapId = Type.Static<typeof MapId>
