import {
    assertExists,
    BaseGameInitializer,
    Game,
    type GameInitializer,
    HydratedTurnManager,
    Player,
    Prng,
    shuffle,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    HydratedMarracashGameState,
    MarracashGameState,
    type FountainState,
    type MarracashProjectedState,
    type ShopState
} from '../model/gameState.js'
import { MarracashPlayerState, StartingMoney } from '../model/playerState.js'
import { AllAntiques, dealAntiqueHands, HydratedAntiqueDeck } from '../components/antiques.js'
import { EntranceFountainIds, Fountains, Shops } from '../components/board.js'
import { generateVisitorSetup } from '../components/visitors.js'
import { MachineState } from './states.js'
import { MarracashColors } from './colors.js'

export class MarracashGameInitializer
    extends BaseGameInitializer<MarracashProjectedState, HydratedMarracashGameState>
    implements GameInitializer<MarracashProjectedState, HydratedMarracashGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedMarracashGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Dealing antiques requires protectedPrng')
        const protectedPrng = new Prng(state.protectedPrng)

        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)

        const visitorSetup = generateVisitorSetup(EntranceFountainIds.length, prng.random)
        const fountains: FountainState[] = Fountains.map((fountain) => {
            const entranceIndex = EntranceFountainIds.indexOf(fountain.id)
            return {
                fountainId: fountain.id,
                visitors: entranceIndex >= 0 ? visitorSetup.entranceGroups[entranceIndex] : []
            }
        })
        const shops: ShopState[] = Shops.map((shop) => ({ shopId: shop.id, customers: 0 }))

        const antiqueCards = game.config?.antiqueCards === true
        let antiqueDeck = HydratedAntiqueDeck.createEmpty()
        if (antiqueCards) {
            const deal = dealAntiqueHands(AllAntiques, players.length, protectedPrng.random)
            assertExists(deal, 'The full antique deck always has a deal for 3 or 4 players')
            players.forEach((player, index) => {
                player.antiques = deal.hands[index]
            })
            antiqueDeck = HydratedAntiqueDeck.create(deal.undealt)
        }

        const marracashState: MarracashGameState = Object.assign(state, {
            players,
            machineState: MachineState.ChoosingAction,
            turnManager,
            shops,
            fountains,
            queue: visitorSetup.queue,
            antiqueCards,
            antiqueDeck,
            round: 1,
            turnActions: [],
            finalRound: false,
            pendingAntiqueSets: [],
            antiqueRevealOrder: [],
            undoStopsOnlyAtReveals: true as const
        })

        return new HydratedMarracashGameState(marracashState)
    }

    private initializePlayers(game: Game, prng: Prng): MarracashPlayerState[] {
        const colors = structuredClone(MarracashColors)
        shuffle(colors, prng.random)

        return game.players.map((player: Player, index: number) => ({
            playerId: player.id,
            color: colors[index],
            money: StartingMoney,
            antiques: [],
            revealedAntiques: []
        }))
    }
}
