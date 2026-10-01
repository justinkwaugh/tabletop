import { GameEngine, type Game } from '@tabletop/common'
import type {
    HydratedMagnaGreciaGameState,
    MagnaGreciaProjectedState
} from '../model/gameState.js'
import { MagnaGreciaRuntime } from './runtime.js'

export class SeededEngine extends GameEngine<
    MagnaGreciaProjectedState,
    HydratedMagnaGreciaGameState
> {
    constructor(private readonly protectedSeed: number) {
        super(MagnaGreciaRuntime)
    }

    override generateUninitializedState(game: Game, masterSeed?: string) {
        return {
            ...super.generateUninitializedState(game, masterSeed),
            protectedPrng: { seed: this.protectedSeed, invocations: 0 }
        }
    }
}
