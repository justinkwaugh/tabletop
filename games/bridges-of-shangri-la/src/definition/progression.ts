import type { GameProgress, GameProgression } from '@tabletop/common'
import { bridgeCount } from '../components/gameBoard.js'
import type { BridgesGameState } from '../model/gameState.js'
import { startingBoard } from './gameInitializer.js'

export class BridgesProgression implements GameProgression<BridgesGameState> {
    progress(state: BridgesGameState): GameProgress {
        const startingBridges = bridgeCount(startingBoard(state.players.length))
        const lastStone = state.stones <= 1
        return {
            fraction: 1 - bridgeCount(state.board) / startingBridges,
            label: lastStone ? 'Last stone' : `${state.stones} stones left`,
            ...(lastStone ? { final: true } : {})
        }
    }
}
