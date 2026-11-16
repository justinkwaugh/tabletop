import {
    BaseGameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { RAILROADS } from '../components/railroads.js'
import { HydratedOstbahnGameState, type OstbahnGameState } from '../model/gameState.js'
import { HydratedOstbahnPlayerState } from '../model/playerState.js'
import { openInitialAuction } from '../stateHandlers/flow.js'
import { OstbahnColors } from './colors.js'
import { MachineState } from './states.js'

export const STARTING_CASH: Record<number, number> = { 3: 40, 4: 30, 5: 24 }

export class OstbahnGameInitializer
    extends BaseGameInitializer<OstbahnGameState, HydratedOstbahnGameState>
    implements GameInitializer<OstbahnGameState, HydratedOstbahnGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedOstbahnGameState {
        const prng = new Prng(state.prng)
        const colors = [...OstbahnColors]
        shuffle(colors, prng.random)
        const cash = STARTING_CASH[game.players.length]
        assertExists(cash, `Preußische Ostbahn has no setup for ${game.players.length} players`)
        const players = game.players.map(
            (player, index) =>
                new HydratedOstbahnPlayerState({ playerId: player.id, color: colors[index], cash })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const ostbahnState: OstbahnGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) => {
                const player = players.find((candidate) => candidate.playerId === playerId)
                assertExists(player, `No player ${playerId} in the seat order`)
                return player
            }),
            machineState: MachineState.ShareBidding,
            turnManager,
            rounds: HydratedRoundManager.generate(),
            railroads: RAILROADS.map((railroad) => ({
                id: railroad.id,
                treasury: 0,
                owners: [],
                track: [railroad.homeSpaceId]
            }))
        })
        const hydrated = new HydratedOstbahnGameState(ostbahnState)
        const [firstBidderId] = turnManager.turnOrder
        assertExists(firstBidderId, 'A game needs players')
        hydrated.machineState = openInitialAuction(hydrated, firstBidderId)
        const bidderId = hydrated.bidding().currentBidderId
        assertExists(bidderId, 'Every player can bid in the first opening auction')
        hydrated.activePlayerIds = [bidderId]
        return hydrated
    }
}
