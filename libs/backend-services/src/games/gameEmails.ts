import type { Game } from '@tabletop/common'
import type { GameStartedProps } from '@tabletop/email'
import { Type, type Static } from 'typebox'

export const GameEmailTask = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        toEmail: Type.String()
    },
    { additionalProperties: false }
)
export type GameEmailTask = Static<typeof GameEmailTask>

export type GameStartedSeats = Pick<
    GameStartedProps,
    'playerNames' | 'yourTurn' | 'activePlayerNames'
>

export function gameStartedSeats(game: Game, userId: string): GameStartedSeats {
    const activePlayerIds = new Set(game.activePlayerIds ?? [])
    const activePlayers = game.players.filter((player) => activePlayerIds.has(player.id))
    return {
        playerNames: game.players.map((player) => player.name),
        yourTurn: activePlayers.some((player) => player.userId === userId),
        activePlayerNames: activePlayers.map((player) => player.name)
    }
}
