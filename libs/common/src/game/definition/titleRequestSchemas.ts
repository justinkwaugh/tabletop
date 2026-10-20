import { Type, type TSchema } from 'typebox'
import { Game } from '../model/game.js'
import { ToAPIAction } from '../engine/gameAction.js'
import { GameCreationOptions } from '../../util/gameSeeds.js'

export function actionRequestSchema(action: TSchema) {
    return Type.Object(
        { gameId: Type.String(), action: ToAPIAction(action) },
        { additionalProperties: false }
    )
}

export function createGameRequestSchema(config: TSchema = Type.Object({})) {
    return Type.Object(
        {
            options: Type.Optional(GameCreationOptions),
            game: Type.Evaluate(
                Type.Intersect([
                    Type.Pick(Game, ['id', 'name', 'players', 'isPublic', 'unlisted', 'seed']),
                    Type.Object({ config: Type.Optional(config) })
                ])
            )
        },
        { additionalProperties: false }
    )
}
