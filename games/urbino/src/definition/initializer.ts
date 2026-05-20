import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedUrbinoGameState, UrbinoGameState } from '../model/gameState.js'
import { HydratedUrbinoPlayerState, UrbinoPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { UrbinoColors } from './colors.js'
import { UrbinoGameConfig } from './config.js'
import { BOARD_SQUARES } from '../logic/board.js'

export class UrbinoGameInitializer
    extends BaseGameInitializer<UrbinoGameState, HydratedUrbinoGameState>
    implements GameInitializer<UrbinoGameState, HydratedUrbinoGameState>
{
    initializeExplorationState(state: UrbinoGameState): UrbinoGameState {
        return state
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedUrbinoGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        const orderedPlayers: UrbinoPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) orderedPlayers.push(player)
        }

        const board = Array<null>(BOARD_SQUARES).fill(null)
        const config = game.config as UrbinoGameConfig

        const urbinoGameState: UrbinoGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.PlacingArchitects,
            turnManager,
            board,
            architects: [-1, -1],
            architectsPlaced: 0,
            consecutivePasses: 0,
            hasRepositionedThisTurn: false,
            monumentsVariant: config?.monuments ?? false,
        })

        return new HydratedUrbinoGameState(urbinoGameState)
    }

    private initializePlayers(game: Game, prng: Prng): UrbinoPlayerState[] {
        const colors = structuredClone(UrbinoColors)
        shuffle(colors, prng.random)

        return game.players.map((player: Player, index: number) => {
            return new HydratedUrbinoPlayerState({
                playerId: player.id,
                color: colors[index],
                houses: 18,
                palaces: 6,
                towers: 3,
                score: 0,
            })
        })
    }
}
