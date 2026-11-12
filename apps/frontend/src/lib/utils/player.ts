import { PlayerStatus, type Game, type Player } from '@tabletop/common'
import { isUsersNonHotseatTurn } from './dashboardGames'

export function playerSortValue(player: Player, ownerId: string) {
    if (player.userId === ownerId) {
        return 0
    } else if (player.status === PlayerStatus.Joined) {
        return 1
    } else if (player.status === PlayerStatus.Reserved) {
        return 2
    } else if (player.name && player.status === PlayerStatus.Open) {
        return 3
    } else if (player.status === PlayerStatus.Declined) {
        return 4
    } else {
        return 5
    }
}

export function playersHostFirst<T extends Player>(players: T[], ownerId: string): T[] {
    return players.toSorted((a, b) => playerSortValue(a, ownerId) - playerSortValue(b, ownerId))
}

export type PlayerHighlight = 'active' | 'winner'

export function playerHighlight(
    game: Pick<Game, 'activePlayerIds' | 'winningPlayerIds'>,
    playerId: string
): PlayerHighlight | undefined {
    if (game.activePlayerIds?.includes(playerId)) return 'active'
    if (game.winningPlayerIds?.includes(playerId)) return 'winner'
    return undefined
}

export function playerStatusDisplay(player: Player, ownerId: string) {
    if (player.userId === ownerId) {
        return 'host'
    }
    switch (player.status) {
        case PlayerStatus.Joined:
            return 'joined'
        case PlayerStatus.Reserved:
            return 'invited'
        case PlayerStatus.Declined:
            return 'declined'
        default:
            return 'open'
    }
}

export function activePlayerText(game: Game, userId: string | undefined) {
    if (isUsersNonHotseatTurn(game, userId)) return 'You'
    const activePlayerIds = game.activePlayerIds ?? []
    if (activePlayerIds.length === 1)
        return game.players.find((player) => player.id === activePlayerIds[0])?.name
    return 'Multiple players'
}
