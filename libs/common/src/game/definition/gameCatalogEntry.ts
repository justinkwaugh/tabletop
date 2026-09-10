import type { GameInfo } from './gameDefinition.js'

export interface GameCatalogEntry extends Pick<GameInfo, 'id' | 'metadata'> {
    thumbnailUrl: string
}
