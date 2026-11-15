import { gameStallLevel, GameStallLevel } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { GameStore } from '../persistence/stores/gameStore.js'
import type { TaskService } from '../tasks/taskService.js'
import type { GameService } from './gameService.js'

export const StalledGameTask = Type.Object(
    { gameId: Type.String() },
    { additionalProperties: false }
)
export type StalledGameTask = Static<typeof StalledGameTask>

export interface StalledGameSweep {
    queuedGameIds: string[]
    awaitingTitleGameIds: string[]
}

/**
 * Ends Stalled Games as abandoned: a daily sweep queues a task for each one whose title offers
 * calls, and each task ends its Game unless somebody moved first.
 */
export class StalledGames {
    constructor(
        private readonly games: Pick<GameStore, 'findStartedGames'>,
        private readonly gameService: Pick<GameService, 'endStalledGame'>,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly supportsCalls: (titleId: string) => Promise<boolean>,
        private readonly now: () => Date = () => new Date()
    ) {}

    async sweep(): Promise<StalledGameSweep> {
        const now = this.now()
        const due = (await this.games.findStartedGames()).filter(
            (game) => gameStallLevel(game, now) === GameStallLevel.Due
        )
        const day = now.toISOString().slice(0, 10)
        const result: StalledGameSweep = { queuedGameIds: [], awaitingTitleGameIds: [] }
        for (const game of due) {
            if (!(await this.titleSupportsCalls(game.typeId))) {
                result.awaitingTitleGameIds.push(game.id)
                continue
            }
            await this.tasks.createPushTask({
                queue: 'maintenance',
                path: '/games/endStalled',
                payload: { gameId: game.id } satisfies StalledGameTask,
                uniqueName: `stalled-game-${game.id}-${day}`
            })
            result.queuedGameIds.push(game.id)
        }
        console.log(JSON.stringify({ event: 'stalled_game_sweep', ...result }))
        return result
    }

    async end({ gameId }: StalledGameTask): Promise<boolean> {
        const ended = await this.gameService.endStalledGame({
            gameId,
            supportsCalls: (titleId) => this.titleSupportsCalls(titleId),
            now: this.now()
        })
        console.log(JSON.stringify({ event: 'stalled_game_end', gameId, ended }))
        return ended
    }

    // A title whose catalog cannot be read waits for a later sweep instead of stopping this one.
    private async titleSupportsCalls(titleId: string): Promise<boolean> {
        try {
            return await this.supportsCalls(titleId)
        } catch (error) {
            console.warn(`Could not read whether ${titleId} offers calls`, error)
            return false
        }
    }
}
