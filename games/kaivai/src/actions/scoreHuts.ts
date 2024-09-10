import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionSource, GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'

export type HutScore = Static<typeof HutScore>
export const HutScore = Type.Object({
    numHuts: Type.Number(),
    score: Type.Number()
})

export type ScoreHuts = Static<typeof ScoreHuts>
export const ScoreHuts = Type.Composite([
    Type.Omit(GameAction, ['source']),
    Type.Object({
        type: Type.Literal(ActionType.ScoreHuts),
        source: Type.Literal(ActionSource.System),
        metadata: Type.Optional(
            Type.Object({
                scores: Type.Record(Type.String(), HutScore)
            })
        )
    })
])

export const ScoreHutsValidator = TypeCompiler.Compile(ScoreHuts)

export function isScoreHuts(action?: GameAction): action is ScoreHuts {
    return action?.type === ActionType.ScoreHuts
}

export class HydratedScoreHuts extends HydratableAction<typeof ScoreHuts> implements ScoreHuts {
    declare type: ActionType.ScoreHuts
    declare source: ActionSource.System
    declare metadata?: { scores: Record<string, HutScore> }

    constructor(data: ScoreHuts) {
        super(data, ScoreHutsValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        this.metadata = { scores: {} }

        for (const player of state.players) {
            const numHuts = state.board.numHutsForPlayer(player.playerId)
            this.metadata.scores[player.playerId] = { numHuts, score: numHuts * 2 }
            player.score += numHuts * 2
        }
    }
}
