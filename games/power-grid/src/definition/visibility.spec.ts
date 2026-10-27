import { describe, expect, it } from 'vitest'
import { ActionSource, Visibility, getPrng } from '@tabletop/common'
import {
    PowerGridGameStateValidator,
    PowerGridProjectedStateValidator,
    type PowerGridGameState,
    type PowerGridProjectedState
} from '../model/gameState.js'
import { isPlant, STEP_3_CARD } from '../model/plantMarket.js'
import { PlantBack, plantBack } from '../components/plants.js'
import { TestGame } from '../testing/testGame.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { PowerGridRuntime } from './runtime.js'

const spectator = { kind: 'spectator' } as const

function canonical(state: PowerGridProjectedState): PowerGridGameState {
    if (!PowerGridGameStateValidator.Check(state)) {
        throw new Error('Expected complete canonical state')
    }
    return state
}

function project(game: TestGame, perspective: Visibility.Perspective = spectator) {
    return PowerGridRuntime.visibility.state.project(canonical(game.state), perspective, {
        config: game.game.config
    })
}

describe('Power Grid visibility', () => {
    it('hides the plant stack but shows its size and the back of its top card', () => {
        const game = new TestGame(4)
        for (const perspective of [spectator, { kind: 'player', playerId: 'p0' } as const]) {
            const projected = project(game, perspective)
            expect(projected).not.toHaveProperty('plantDeck')
            expect(projected).not.toHaveProperty('masterSeed')
            expect(projected.deckCount).toBe(game.state.plantDeck?.length)
            expect(projected.deckTopBack).toBe(PlantBack.Plug)
            expect(PowerGridProjectedStateValidator.Check(projected)).toBe(true)
        }
    })

    it('marks a draw from the stack as information-revealing', () => {
        const game = new TestGame(3)
        const [chooser] = game.state.activePlayerIds
        const plant = game.hydrated.auctionablePlants()[2]
        game.execute({
            id: 'open',
            gameId: game.state.gameId,
            source: ActionSource.User,
            playerId: chooser,
            type: ActionType.ChoosePlant,
            plant,
            bid: plant
        })
        const drawn = game.state.plantDeck?.[0]
        for (let pass = 0; pass < 2; pass++) {
            const [bidder] = game.state.activePlayerIds
            game.execute({
                id: `pass-${pass}`,
                gameId: game.state.gameId,
                source: ActionSource.User,
                playerId: bidder,
                type: ActionType.PassBid
            })
        }
        const replace = game.actions.findLast((action) => action.type === ActionType.ReplacePlant)
        expect(replace?.revealsInfo).toBe(true)
        expect(game.state.market).toContain(drawn)
    })

    it('fills an exploration stack with unseen plants, the Step 3 card last', () => {
        const game = new TestGame(4)
        game.playUntil(
            (state) => state.round === 3 && state.machineState === MachineState.ChoosingPlant
        )
        const projected = project(game)
        const explored = PowerGridRuntime.exploration.createFromProjectedState({
            game: game.game,
            state: projected,
            actions: [],
            perspective: spectator,
            random: getPrng(42)
        })
        expect(PowerGridGameStateValidator.Check(explored)).toBe(true)
        const deck = explored.plantDeck ?? []
        expect(deck).toHaveLength(projected.deckCount)
        expect(deck.at(-1)).toBe(STEP_3_CARD)
        const seen = new Set([
            ...projected.market.filter(isPlant),
            ...projected.underStack,
            ...projected.players.flatMap((player) => player.plants)
        ])
        expect(deck.filter(isPlant).some((plant) => seen.has(plant))).toBe(false)
        const top = deck[0]
        expect(isPlant(top) && plantBack(top)).toBe(projected.deckTopBack)
    })
})
