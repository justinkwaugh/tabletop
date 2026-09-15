import {
    GameStatus,
    GameStatusCategory,
    getGameStatusesForCategory,
    type Game
} from '@tabletop/common'

export function gameUserIds(game: Pick<Game, 'players'>): string[] {
    return [
        ...new Set(game.players.flatMap((player) => (player.userId == null ? [] : [player.userId])))
    ]
}

export class GameCacheKeys {
    static game(gameId: string): string {
        return `game-${gameId}`
    }

    static checksum(gameId: string): string {
        return `csum-${gameId}`
    }

    static revision(gameId: string): string {
        return `etag-${gameId}`
    }

    static userList(userId: string, category: GameStatusCategory): string {
        return `games-${category}-${userId}`
    }

    static publicList(titleId: string): string {
        return `games-public-${titleId}`
    }

    static history(userId: string, older = false): string {
        return `game-history-${older ? 'older' : 'head'}-${userId}`
    }

    static historyPage(userId: string, cursor: string): string {
        return `game-history-page-${userId}-${cursor}`
    }

    static chatRevision(gameId: string): string {
        return `etag-${gameId}-chat`
    }

    static chatWrite(gameId: string): string[] {
        return [`csum-${gameId}-chat`, this.chatRevision(gameId)]
    }

    static bookmark(gameId: string, playerId: string): string {
        return `bookmark-${gameId}-${playerId}`
    }

    static gameWrite(gameId: string): string[] {
        return [this.game(gameId), ...this.stateWrite(gameId)]
    }

    static stateWrite(gameId: string): string[] {
        return [this.checksum(gameId), this.revision(gameId)]
    }

    static changedLists(before: Game | undefined, after: Game | undefined): string[] {
        const oldLists = this.listsContaining(before)
        const newLists = this.listsContaining(after)
        const historyUsers = new Set([
            ...(before?.status === GameStatus.Finished ? gameUserIds(before) : []),
            ...(after?.status === GameStatus.Finished ? gameUserIds(after) : [])
        ])
        const historyKeys = [...historyUsers].flatMap((userId) => [
            this.history(userId),
            ...(before?.status === GameStatus.Finished || before === undefined
                ? [this.history(userId, true)]
                : [])
        ])
        return [
            ...historyKeys,
            ...[...oldLists].filter((key) => !newLists.has(key)),
            ...[...newLists].filter((key) => !oldLists.has(key))
        ]
    }

    private static listsContaining(game: Game | undefined): Set<string> {
        const keys = new Set<string>()
        if (!game) return keys
        for (const category of Object.values(GameStatusCategory)) {
            if (!getGameStatusesForCategory(category).includes(game.status)) continue
            for (const userId of gameUserIds(game)) keys.add(this.userList(userId, category))
        }
        if (game.isPublic && game.status === GameStatus.WaitingForPlayers) {
            keys.add(this.publicList(game.typeId))
        }
        return keys
    }
}
