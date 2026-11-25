import {
    GAME_FOLLOW_LIMIT,
    UserStatus,
    canFollowGame,
    type Game,
    type User
} from '@tabletop/common'
import type { GameStore } from '../persistence/stores/gameStore.js'
import type { GameFollowStore } from '../persistence/stores/gameFollowStore.js'
import { AccountUnavailableError } from '../users/errors.js'
import { GameNotFoundError, GameNotFollowableError, GameFollowLimitReachedError } from './errors.js'

export class GameFollowService {
    constructor(
        private readonly games: Pick<GameStore, 'findGamesById'>,
        private readonly follows: Pick<
            GameFollowStore,
            'addFollow' | 'removeFollow' | 'removeIneligibleFollows' | 'findFollowedGameIds'
        >
    ) {}

    async followGame(user: User, gameId: string): Promise<void> {
        const addition = await this.follows.addFollow({
            userId: user.id,
            gameId,
            limit: GAME_FOLLOW_LIMIT,
            eligible: (game) => canFollowGame(game, user.id)
        })
        if (addition === 'accountUnavailable') throw new AccountUnavailableError(UserStatus.Deleted)
        if (addition === 'gameNotFound') throw new GameNotFoundError({ id: gameId })
        if (addition === 'notFollowable') throw new GameNotFollowableError({ id: gameId })
        if (addition === 'limitReached')
            throw new GameFollowLimitReachedError({ limit: GAME_FOLLOW_LIMIT })
    }

    async unfollowGame(user: User, gameId: string): Promise<void> {
        await this.follows.removeFollow({ userId: user.id, gameId })
    }

    async getFollowedGames(user: User): Promise<Game[]> {
        const ids = await this.follows.findFollowedGameIds(user.id)
        if (ids.length === 0) return []
        const games = (await this.games.findGamesById(ids)).filter((game) =>
            canFollowGame(game, user.id)
        )
        await this.pruneFollows(user, ids, games)
        return games
    }

    // A follow outlives its eligibility when its game is archived, or when a cleanup after a
    // seat change or deletion fails. Pruning it here keeps the follow limit to the games listed.
    private async pruneFollows(user: User, ids: string[], listed: Game[]): Promise<void> {
        const kept = new Set(listed.map((game) => game.id))
        try {
            await this.follows.removeIneligibleFollows({
                userId: user.id,
                gameIds: ids.filter((id) => !kept.has(id)),
                eligible: (game) => canFollowGame(game, user.id)
            })
        } catch (error) {
            console.error('Pruning stale game follows failed', { userId: user.id, error })
        }
    }
}
