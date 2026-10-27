import { shuffle, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import { POWER_PLANTS, plantBack } from '../components/plants.js'
import { Step } from '../components/rules.js'
import type { PowerGridProjectedState } from '../model/gameState.js'
import { STEP_3_CARD, isPlant, type DeckCard } from '../model/plantMarket.js'

export class PowerGridGameExploration implements GameExploration<PowerGridProjectedState> {
    createFromCanonicalState(state: PowerGridProjectedState): PowerGridProjectedState {
        return state
    }

    // The visible back of the top card and the Step 3 card at the bottom are public, so they
    // are kept.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<PowerGridProjectedState>): PowerGridProjectedState {
        const seen = new Set<number>([
            ...state.market.filter(isPlant),
            ...state.underStack,
            ...state.outOfGame,
            ...state.players.flatMap((player) => player.plants),
            ...(state.trust?.plants ?? [])
        ])
        const unseen = POWER_PLANTS.map((plant) => plant.number).filter(
            (number) => !seen.has(number)
        )
        shuffle(unseen, random)
        const step3ToCome = state.step !== Step.Three && !state.step3Drawn
        const plantCount = state.deckCount - (step3ToCome ? 1 : 0)
        const topIndex = unseen.findIndex((number) => plantBack(number) === state.deckTopBack)
        if (topIndex > 0) {
            unseen.unshift(...unseen.splice(topIndex, 1))
        }
        const deck: DeckCard[] = unseen.slice(0, plantCount)
        return { ...state, plantDeck: step3ToCome ? [...deck, STEP_3_CARD] : deck }
    }
}
