import { assertExists, type GameProgress, type GameProgression } from '@tabletop/common'
import { bridgeCount } from '../components/gameBoard.js'
import type { BridgesGameState } from '../model/gameState.js'
import { startingBoard } from './gameInitializer.js'

const startingBridges = new Map<number, number>()

export class BridgesProgression implements GameProgression<BridgesGameState> {
    progress(state: BridgesGameState): GameProgress {
        const players = state.players.length
        if (!startingBridges.has(players))
            startingBridges.set(players, bridgeCount(startingBoard(players)))
        const bridges = startingBridges.get(players)
        assertExists(bridges, 'Starting bridges are counted for every player count')
        const lastStone = state.stones <= 1
        return {
            fraction: 1 - bridgeCount(state.board) / bridges,
            label: lastStone ? 'Last stone' : `${state.stones} stones left`,
            ...(lastStone ? { final: true } : {})
        }
    }
}
