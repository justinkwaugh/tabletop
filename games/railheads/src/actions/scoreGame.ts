import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Industry } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { PayoutRates, PlayerIncome, payPlayers } from '../model/payouts.js'

export type IndustrySitesReached = Type.Static<typeof IndustrySitesReached>
export const IndustrySitesReached = Type.Object({
    industry: Type.Enum(Industry),
    sites: Type.Number()
})

export type ScoreGameMetadata = Type.Static<typeof ScoreGameMetadata>
export const ScoreGameMetadata = Type.Object({
    rates: PayoutRates,
    sitesReached: Type.Array(IndustrySitesReached),
    income: Type.Array(PlayerIncome)
})

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

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        const rates = state.finalPayouts()
        const sitesReached = rates.industries.map(({ industry }) => ({
            industry,
            sites: state.industrySitesReached(industry)
        }))
        const income = payPlayers(state, rates)
        this.metadata = { rates, sitesReached, income }
    }
}
