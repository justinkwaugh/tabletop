import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    GameResult,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import { BarrelTieBreak, decideWinners, FinalSheetRow, scoreFinal } from '../model/finalScoring.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

export type ScoreGameMetadata = Type.Static<typeof ScoreGameMetadata>
export const ScoreGameMetadata = Type.Object({
    /** R-6.2 One row per seat, in turn order, each sealed charter revealed. */
    sheet: Type.Array(FinalSheetRow),
    /** R-6.3 */
    winners: Type.Array(Type.String()),
    /** R-6.3 Present only when the vp were tied. */
    barrelTieBreak: Type.Optional(BarrelTieBreak)
})

export type ScoreGame = Type.Static<typeof ScoreGame>
export const ScoreGame = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.ScoreGame),
            source: Type.Literal(ActionSource.System),
            revealsInfo: Type.Literal(true),
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
    declare source: ActionSource.System
    declare revealsInfo: true
    declare metadata?: ScoreGameMetadata

    constructor(data: ScoreGame) {
        super(data, ScoreGameValidator)
    }

    /** R-6.2, R-6.3, R-X.2 The sealed charters are revealed here: always a barrier. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        beginPhase(state, PhaseName.FinalScoring)
        const sheet = scoreFinal(state)
        const { winners, barrelTieBreak } = decideWinners(state)
        state.winningPlayerIds = winners
        state.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        this.metadata = { sheet, winners, ...(barrelTieBreak ? { barrelTieBreak } : {}) }
    }
}
