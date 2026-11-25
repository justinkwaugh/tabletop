import { PlayerStatus, type Game, type Player } from '@tabletop/common'
import { m } from '$lib/paraglide/messages'
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
        return m.games_player_status_host()
    }
    switch (player.status) {
        case PlayerStatus.Joined:
            return m.games_player_status_joined()
        case PlayerStatus.Reserved:
            return m.games_player_status_invited()
        case PlayerStatus.Declined:
            return m.games_player_status_declined()
        default:
            return m.games_player_status_open()
    }
}

export function activePlayerText(game: Game, userId: string | undefined) {
    const activePlayerIds = game.activePlayerIds ?? []
    if (activePlayerIds.length !== 1) return m.games_player_multiple()
    if (isUsersNonHotseatTurn(game, userId)) return m.games_player_you()
    return game.players.find((player) => player.id === activePlayerIds[0])?.name
}

export function ownerName(game: Pick<Game, 'players' | 'ownerId'>): string | undefined {
    return game.players.find((player) => player.userId === game.ownerId)?.name
}
