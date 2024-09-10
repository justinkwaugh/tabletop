import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionSource, GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'

export type ScoreHuts = Static<typeof ScoreHuts>
export const ScoreHuts = Type.Composite([
    Type.Omit(GameAction, ['source']),
    Type.Object({
        type: Type.Literal(ActionType.ScoreHuts),
        source: Type.Literal(ActionSource.System)
    })
])

export const ScoreHutsValidator = TypeCompiler.Compile(ScoreHuts)

export function isScoreHuts(action?: GameAction): action is ScoreHuts {
    return action?.type === ActionType.ScoreHuts
}

export class HydratedScoreHuts extends HydratableAction<typeof ScoreHuts> implements ScoreHuts {
    declare type: ActionType.ScoreHuts
    declare source: ActionSource.System

    constructor(data: ScoreHuts) {
        super(data, ScoreHutsValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        // easier once tracking hut pieces
        for (const player of state.players) {
            player.score += state.board.numHutsForPlayer(player.playerId) * 2
        }
    }
}
