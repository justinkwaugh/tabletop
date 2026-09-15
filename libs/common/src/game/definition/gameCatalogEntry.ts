import * as Type from 'typebox'
import { GameMetadata } from './gameMetadata.js'

export const GameCatalogEntry = Type.Object({
    id: Type.String({ minLength: 1 }),
    metadata: GameMetadata,
    thumbnailUrl: Type.String({ minLength: 1 })
})
export type GameCatalogEntry = Type.Static<typeof GameCatalogEntry>
