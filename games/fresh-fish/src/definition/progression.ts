import type { GameProgress, GameProgression } from '@tabletop/common'
import { CellType } from '../components/cells.js'
import { HydratedFreshFishGameState, type FreshFishProjectedState } from '../model/gameState.js'
import { GoodsType } from './goodsType.js'
import { MachineState } from './states.js'

const finalStallCount = Object.values(GoodsType).length

export class FreshFishProgression implements GameProgression<FreshFishProjectedState> {
    progress(data: FreshFishProjectedState): GameProgress {
        const state = new HydratedFreshFishGameState(data)
        const remaining = state.tileBag.remaining
        const finalStallsPlaced = finalStallCount - state.finalStalls.length
        const drawn =
            [...state.board].filter(({ cell }) => cell.type === CellType.Market).length +
            state.players.flatMap((player) => player.stalls).filter((stall) => stall.placed)
                .length -
            finalStallsPlaced +
            (state.chosenTile && state.machineState !== MachineState.TileBagEmptied ? 1 : 0)
        const placingFinalStalls =
            state.machineState === MachineState.TileBagEmptied ||
            state.machineState === MachineState.EndOfGame
        return {
            fraction: (drawn + finalStallsPlaced) / (drawn + remaining + finalStallCount),
            label: placingFinalStalls
                ? 'Final stalls'
                : remaining === 0
                  ? 'Last tile'
                  : `${remaining} ${remaining === 1 ? 'tile' : 'tiles'} left`,
            ...(placingFinalStalls ? { final: true } : {})
        }
    }
}
