import * as Type from 'typebox'
import { GameMetadata } from './gameMetadata.js'

export enum GameClientCapability {
    CalledGames = 'calledGames'
}

export const GameCatalogEntry = Type.Object({
    id: Type.String({ minLength: 1 }),
    metadata: GameMetadata,
    thumbnailUrl: Type.String({ minLength: 1 }),
    clientCapabilities: Type.Optional(Type.Array(Type.String()))
})
export type GameCatalogEntry = Type.Static<typeof GameCatalogEntry>
