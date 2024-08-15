import { Type, type Static } from '@sinclair/typebox'

export type GameConfig = Static<typeof GameConfig>
export const GameConfig = Type.Object({})
