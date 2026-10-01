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
import { AntiquesPerPlayer, HydratedAntiqueDeck } from '../components/antiques.js'
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

        const antiqueDeck = HydratedAntiqueDeck.create(protectedPrng.random)
        for (const player of players) {
            player.antiques = antiqueDeck.drawItems(AntiquesPerPlayer)
        }

        const marracashState: MarracashGameState = Object.assign(state, {
            players,
            machineState: MachineState.ChoosingAction,
            turnManager,
            shops,
            fountains,
            queue: visitorSetup.queue,
            antiqueDeck,
            round: 1,
            turnActions: [],
            pendingAntiqueSets: [],
            antiqueRevealOrder: []
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
