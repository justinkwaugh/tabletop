import * as Type from 'typebox'
import { RAILROAD_IDS } from '../components/railroads.js'
import { TOWN_TILE_KIND_IDS } from '../components/townTiles.js'

export const RailroadIdSchema = Type.Enum(RAILROAD_IDS)

export const SpaceIdSchema = Type.TemplateLiteral('space.${number}.${number}')

export const TownTileKindIdSchema = Type.Enum(TOWN_TILE_KIND_IDS)

export function PerRailroad<Value extends Type.TSchema>(value: Value) {
    return Type.Record(RailroadIdSchema, value, { additionalProperties: false })
}

export function PerSpace<Value extends Type.TSchema>(value: Value) {
    return Type.Record(SpaceIdSchema, value, { additionalProperties: false })
}
