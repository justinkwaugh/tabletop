import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { assertExists, Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedMarracashGameState, MarracashGameState } from '../model/gameState.js'
import { HydratedMarracashPlayerState, MarracashPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { MarracashColors } from './colors.js'

export class MarracashGameInitializer
    extends BaseGameInitializer<MarracashGameState, HydratedMarracashGameState>
    implements GameInitializer<MarracashGameState, HydratedMarracashGameState>
{
    initializeGameState(game: Game, state: UninitializedGameState): HydratedMarracashGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        const turnManager = HydratedTurnManager.generate(players, prng.random)

        const orderedPlayers: MarracashPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            assertExists(player, `Player ${playerId} in the turn order has no player state`)
            orderedPlayers.push(player)
        }

        const marracashGameState: MarracashGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.ChoosingAction,
            turnManager: turnManager
        })

        return new HydratedMarracashGameState(marracashGameState)
    }

    private initializePlayers(game: Game, prng: Prng): MarracashPlayerState[] {
        const colors = structuredClone(MarracashColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedMarracashPlayerState({
                playerId: player.id,
                color: colors[index]
            })
        })

        return players
    }
}
