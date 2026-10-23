import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { readSetup } from '../definition/setup.js'
import { Standing, type HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { standings } from '../model/scoring.js'

export type ScoreGameMetadata = Type.Static<typeof ScoreGameMetadata>
export const ScoreGameMetadata = Type.Object({ standings: Type.Array(Standing) })

export type ScoreGame = Type.Static<typeof ScoreGame>
export const ScoreGame = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ScoreGame),
            metadata: Type.Optional(ScoreGameMetadata)
        })
    ])
)

export const ScoreGameValidator = Compile(ScoreGame)

export function isScoreGame(action?: GameAction): action is ScoreGame {
    return action?.type === ActionType.ScoreGame
}

export class HydratedScoreGame extends HydratableAction<typeof ScoreGame> implements ScoreGame {
    declare type: ActionType.ScoreGame
    declare metadata?: ScoreGameMetadata

    constructor(data: ScoreGame) {
        super(data, ScoreGameValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, context?: MachineContext) {
        assertExists(context, 'Scoring needs the game configuration')
        state.standings = standings(state.players, readSetup(context.gameConfig).strictEcology)
        this.metadata = { standings: state.standings }
    }
}
