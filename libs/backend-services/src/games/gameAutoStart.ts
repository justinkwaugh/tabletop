import { findPlayerForUserId, GameStatus, type Game } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { TaskService } from '../tasks/taskService.js'

export const GAME_AUTO_START_DELAY_MS = 60_000

export const GameAutoStartTask = Type.Object(
    {
        gameId: Type.String(),
        autoStartAt: Type.Number()
    },
    { additionalProperties: false }
)
export type GameAutoStartTask = Static<typeof GameAutoStartTask>

function startsAutomatically(game: Game): boolean {
    return game.isPublic || !findPlayerForUserId(game, game.ownerId)
}

function isReadyAutoStartingGame(game: Game): boolean {
    return game.status === GameStatus.WaitingToStart && startsAutomatically(game)
}

export function gameAutoStartChange(
    existingGame: Game,
    updatedGame: Game,
    now: number
): Pick<Game, 'autoStartAt'> | undefined {
    if (isReadyAutoStartingGame(updatedGame)) {
        return isReadyAutoStartingGame(existingGame)
            ? undefined
            : { autoStartAt: new Date(now + GAME_AUTO_START_DELAY_MS) }
    }
    return updatedGame.autoStartAt ? { autoStartAt: undefined } : undefined
}

export async function enqueueGameAutoStart(
    tasks: Pick<TaskService, 'createPushTask'>,
    gameId: string,
    autoStartAt: Date
): Promise<void> {
    await tasks.createPushTask({
        queue: 'game-auto-start',
        path: '/games/autoStart',
        payload: { gameId, autoStartAt: autoStartAt.getTime() },
        inSeconds: Math.ceil((autoStartAt.getTime() - Date.now()) / 1000)
    })
}
