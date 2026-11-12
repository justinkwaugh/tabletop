import { GameEngine, GameProgress, PlayerStatus, reportGameProgress } from '@tabletop/common'
import type { GameDefinition } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import * as Value from 'typebox/value'

export function startedGameProgress<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & Raw
>(definition: GameDefinition<Raw, State>, playerCount: number) {
    const game = definition.runtime.initializer.initializeGame(
        {
            id: 'game-progress',
            typeId: definition.info.id,
            ownerId: 'p0',
            config: {},
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index}`,
                name: `p${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    const { startedGame, initialState } = new GameEngine(definition.runtime).startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    const progressAt = (changes: Partial<Raw> = {}): GameProgress | undefined => {
        const progress = reportGameProgress(definition.runtime, { ...initialState, ...changes })
        if (progress && !Value.Check(GameProgress, progress)) throw Error('Invalid Game Progress')
        return progress
    }
    return { startedGame, initialState, progressAt }
}
