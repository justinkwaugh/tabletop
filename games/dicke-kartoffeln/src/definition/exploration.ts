import { shuffle, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import { MESSAGE_IDS } from '../components/messages.js'
import { readSetup } from './setup.js'
import {
    HydratedDickeKartoffelnGameState,
    type DickeKartoffelnProjectedState
} from '../model/gameState.js'
import { planners } from '../model/planRules.js'
import { emptyPlan, isPlanningState, planKindFor } from '../model/plans.js'

// A hypothetical game knows only the face-up and read messages, so the unseen cards are dealt
// into a fresh deck order; a rival's sealed plan becomes the plan to do nothing.
export class DickeKartoffelnGameExploration implements GameExploration<DickeKartoffelnProjectedState> {
    createFromCanonicalState(state: DickeKartoffelnProjectedState): DickeKartoffelnProjectedState {
        return structuredClone(state)
    }

    createFromProjectedState({
        state,
        game,
        random
    }: ExplorationPopulation<DickeKartoffelnProjectedState>): DickeKartoffelnProjectedState {
        const result = structuredClone(state)
        const messages = result.messages
        if (messages) {
            const seen = new Set([
                ...messages.spaces.map((card) => card.messageId),
                ...messages.read
            ])
            const unseen = MESSAGE_IDS.filter((messageId) => !seen.has(messageId))
            shuffle(unseen, random)
            messages.deck = { items: unseen, remaining: unseen.length }
        }
        if (isPlanningState(result.machineState)) {
            const hydrated = new HydratedDickeKartoffelnGameState(result)
            const round = result.machineState
            for (const playerId of planners(hydrated, round, readSetup(game.config))) {
                const player = result.players.find((candidate) => candidate.playerId === playerId)
                if (
                    player &&
                    player.plan === undefined &&
                    !result.activePlayerIds.includes(playerId)
                ) {
                    player.plan = emptyPlan(planKindFor(round))
                }
            }
        }
        return result
    }
}
