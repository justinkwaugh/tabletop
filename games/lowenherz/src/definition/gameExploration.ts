import {
    assert,
    type ExplorationPopulation,
    type RandomFunction,
    shuffle,
    type GameExploration
} from '@tabletop/common'
import {
    HydratedLowenherzGameState,
    LowenherzGameState,
    LowenherzGameStateValidator,
    LowenherzProjectedState
} from '../model/gameState.js'
import { populateLowenherzExploration } from '../util/exploration.js'

export class LowenherzGameExploration implements GameExploration<LowenherzProjectedState> {
    createFromCanonicalState(state: LowenherzProjectedState): LowenherzProjectedState {
        const hydrated = new HydratedLowenherzGameState(state)
        return this.reshuffleHiddenCards(hydrated, hydrated.getProtectedPrng().random)
    }

    createFromProjectedState(
        input: ExplorationPopulation<LowenherzProjectedState>
    ): LowenherzGameState {
        assert(
            input.game.config.privateMoney !== true && input.state.publicMoney !== false,
            'Exploration is unavailable with private money'
        )
        if ((input.state.systemVersion ?? 1) < 3) {
            const state = this.reshuffleHiddenCards(
                new HydratedLowenherzGameState(input.state),
                input.random
            )
            assert(
                LowenherzGameStateValidator.Check(state),
                'Legacy Exploration requires complete state'
            )
            return state
        }
        return populateLowenherzExploration(input)
    }

    private reshuffleHiddenCards(
        hydrated: HydratedLowenherzGameState,
        random: RandomFunction
    ): LowenherzProjectedState {
        const deck = hydrated.getActionDeck()
        const backs = [...new Set(deck.map((card) => card.back))]
        hydrated.actionDeck = backs.flatMap((back) => {
            const group = deck.filter((card) => card.back === back)
            shuffle(group, random)
            return group
        })
        const pooled = [...hydrated.getPoliticsPile('A'), ...hydrated.getPoliticsPile('B')]
        shuffle(pooled, random)
        const size = hydrated.getPoliticsPile('A').length
        hydrated.politicsCardPileA = pooled.slice(0, size)
        hydrated.politicsCardPileB = pooled.slice(size)
        for (const player of hydrated.players) {
            if (player.politicsInspection) {
                player.politicsInspection.cards = structuredClone(
                    hydrated.getPoliticsPile(player.politicsInspection.pile)
                )
            }
        }
        return hydrated.dehydrate()
    }
}
