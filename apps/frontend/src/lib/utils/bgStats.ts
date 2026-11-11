import {
    assertExists,
    findPlayerForUserId,
    GameCategory,
    GameResult,
    GameStatus,
    type Game,
    type GameMetadata,
    type User
} from '@tabletop/common'
import { recordedFinalScores } from './gameScores.js'

function finishingRank(
    playerId: string,
    game: Game,
    scores: NonNullable<Game['finalScores']>
): number {
    if (game.winningPlayerIds.includes(playerId)) {
        return 1
    }
    return (
        1 +
        game.players.filter(
            (other) =>
                game.winningPlayerIds.includes(other.id) || scores[other.id] > scores[playerId]
        ).length
    )
}

export function bgStatsPlayUrl(
    game: Game,
    metadata: GameMetadata | undefined,
    user: User | undefined
): string | undefined {
    if (
        !user?.preferences?.bgStatsEnabled ||
        !metadata ||
        game.deleted ||
        game.hotseat ||
        game.status !== GameStatus.Finished ||
        (game.result !== GameResult.Win && game.result !== GameResult.Draw) ||
        game.category === GameCategory.Exploration ||
        !findPlayerForUserId(game, user.id)
    ) {
        return undefined
    }

    assertExists(game.finishedAt, 'Finished games require a completion timestamp')
    const scores = recordedFinalScores(game, metadata)
    // BG Stats for Android rejects a play missing noPoints, highestWins, winner or startPlayer.
    const play = {
        sourceName: 'BoardTogether',
        sourcePlayId: game.id,
        playDate: new Date(game.finishedAt).toISOString().slice(0, 19).replace('T', ' '),
        location: 'BoardTogether',
        game: {
            name: metadata.name,
            sourceGameId: game.typeId,
            bggId: metadata.bggId,
            noPoints: metadata.hasScores === false,
            highestWins: true
        },
        players: game.players.map((player) => ({
            name: player.name,
            sourcePlayerId: player.userId ? `user:${player.userId}` : `player:${player.id}`,
            score: scores?.[player.id],
            rank: scores && finishingRank(player.id, game, scores),
            winner: game.winningPlayerIds.includes(player.id),
            // Hosted Games don't record a reliable start player.
            startPlayer: false
        }))
    }

    return `https://app.bgstatsapp.com/createPlay.html?data=${encodeURIComponent(JSON.stringify(play))}`
}
