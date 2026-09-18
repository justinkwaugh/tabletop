import * as Type from 'typebox'
import { Game } from './game.js'
import { GameConfigOptions } from './gameConfig.js'

export const PublicGamePreview = Type.Object(
    {
        ...Type.Pick(Game, ['id', 'typeId', 'name', 'ownerId', 'status', 'players', 'config'])
            .properties,
        titleName: Type.String(),
        configOptions: GameConfigOptions
    },
    { additionalProperties: false }
)
export type PublicGamePreview = Type.Static<typeof PublicGamePreview>
