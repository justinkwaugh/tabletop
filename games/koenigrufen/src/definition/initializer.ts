import {
    assertExists,
    BaseGameInitializer,
    Game,
    type GameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    shuffle,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { newAuction } from '../model/auction.js'
import {
    HydratedKoenigrufenGameState,
    type KoenigrufenGameState,
    type KoenigrufenProjectedState
} from '../model/gameState.js'
import { newPlayerState } from '../model/playerState.js'
import { KoenigrufenColors } from './colors.js'
import { dealsFor, TimesAround } from './config.js'
import { MachineState } from './states.js'

export class KoenigrufenGameInitializer
    extends BaseGameInitializer<KoenigrufenProjectedState, HydratedKoenigrufenGameState>
    implements GameInitializer<KoenigrufenProjectedState, HydratedKoenigrufenGameState>
{
    readonly supportsStartingPositions = true

    // Turn order runs anticlockwise round the table; the last seat deals first, so the first seat is
    // Forehand.
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedKoenigrufenGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Dealing requires protectedPrng')

        const colors = structuredClone(KoenigrufenColors)
        shuffle(colors, prng.random)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player, index) => ({ playerId: player.id, color: colors[index] })),
            prng.random,
            assignment
        )
        const dealerId = turnManager.turnOrder.at(-1)
        assertExists(dealerId, 'Königrufen needs players')
        const timesAround =
            Object.values(TimesAround).find((value) => value === game.config?.timesAround) ??
            TimesAround.Three

        const koenigrufenState: KoenigrufenGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) => {
                const index = game.players.findIndex((player) => player.id === playerId)
                return newPlayerState(playerId, colors[index])
            }),
            machineState: MachineState.Bidding,
            turnManager,
            roundManager: HydratedRoundManager.generate(),
            totalDeals: dealsFor(timesAround),
            dealerId,
            talon: [],
            auction: newAuction(),
            tricks: []
        })

        // Deal from the hydrated state's own PRNG, so the draws it makes are saved with it.
        const hydrated = new HydratedKoenigrufenGameState(koenigrufenState)
        hydrated.dealHand(hydrated.getProtectedPrng().random)
        return hydrated
    }
}
