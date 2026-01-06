import { PlayerStatus, type Player } from '@tabletop/common'

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
