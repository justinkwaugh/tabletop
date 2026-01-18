import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    MachineContext,
    remove
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { KaivaiGameConfig, Ruleset } from '../definition/gameConfig.js'

export type PlayerIslandMajority = Type.Static<typeof PlayerIslandMajority>
export const PlayerIslandMajority = Type.Object({
    huts: Type.Number(),
    boats: Type.Number(),
    influence: Type.Number()
})

export type ScoreIsland = Type.Static<typeof ScoreIsland>
export const ScoreIsland = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.ScoreIsland),
            source: Type.Literal(ActionSource.System),
            islandId: Type.String(),
            metadata: Type.Optional(
                Type.Object({
                    playerMajorities: Type.Record(Type.String(), PlayerIslandMajority),
                    winners: Type.Array(Type.String()),
                    award: Type.Number()
                })
            )
        })
    ])
)

export const ScoreIslandValidator = Compile(ScoreIsland)

export function isScoreIsland(action?: GameAction): action is ScoreIsland {
    return action?.type === ActionType.ScoreIsland
}

export class HydratedScoreIsland
    extends HydratableAction<typeof ScoreIsland>
    implements ScoreIsland
{
    declare type: ActionType.ScoreIsland
    declare source: ActionSource.System
    declare islandId: string
    declare metadata?: {
        playerMajorities: Record<string, PlayerIslandMajority>
        winners: string[]
        award: number
    }

    constructor(data: ScoreIsland) {
        super(data, ScoreIslandValidator)
    }

    apply(state: HydratedKaivaiGameState, context?: MachineContext) {
        const island = state.board.islands[this.islandId]
        const playerMajorities: Record<string, PlayerIslandMajority> = {}

        for (const playerState of state.players) {
            const playerId = playerState.playerId

            const huts = state.board.numHutsOnIsland(island.id, playerId)
            const boats = state.board.numBoatsAtIslandCultSites(island.id, playerId)
            const influence = state.bids[playerId] ?? 0

            playerMajorities[playerId] = { huts, boats, influence }
        }

        const maxValue = Math.max(
            ...Object.values(playerMajorities).map(
                (majority) => majority.huts + majority.boats + majority.influence
            )
        )
        const winners = Object.entries(playerMajorities)
            .filter(
                ([, majority]) => majority.huts + majority.boats + majority.influence === maxValue
            )
            .map(([playerId]) => playerId)

        const config = context?.gameConfig as KaivaiGameConfig

        let award = 0
        if (winners.length === 1) {
            const actualWinner = state.getPlayerState(winners[0])
            award = state.board.numCultSitesOnIsland(island.id)
            actualWinner.score += award

            // Only winner loses their bid in 1st edition
            if (config.ruleset === Ruleset.FirstEdition) {
                actualWinner.influence -= playerMajorities[actualWinner.playerId].influence
            }
        }

        // Everyone loses their bids in 2nd edition
        if (config.ruleset === Ruleset.SecondEdition) {
            for (const playerId of Object.keys(state.bids)) {
                const playerState = state.getPlayerState(playerId)
                playerState.influence -= state.bids[playerId] ?? 0
            }
        }

        remove(state.islandsToScore, this.islandId)
        this.metadata = { playerMajorities, winners, award }
    }
}
