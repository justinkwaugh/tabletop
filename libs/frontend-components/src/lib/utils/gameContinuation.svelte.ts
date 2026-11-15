import { assertExists, PlayerStatus, type Game, type Player, type User } from '@tabletop/common'
import { nanoid } from 'nanoid'

export type EditableGame = Pick<
    Game,
    | 'id'
    | 'typeId'
    | 'name'
    | 'players'
    | 'isPublic'
    | 'unlisted'
    | 'paceMinutes'
    | 'hotseat'
    | 'ownerId'
    | 'config'
>

export function continuationGame(
    source: Game,
    user: User | undefined,
    ownerPlayer: () => Player
): EditableGame {
    assertExists(user, 'Continuing a game requires a signed-in user')
    return {
        id: nanoid(),
        typeId: source.typeId,
        name: source.name,
        players: source.players.map((player) =>
            isUsersSeat(source, player, user) ? ownerPlayer() : continuedPlayer(source, player)
        ),
        isPublic: source.isPublic,
        ...(source.unlisted ? { unlisted: true } : {}),
        ...(source.paceMinutes === undefined ? {} : { paceMinutes: source.paceMinutes }),
        hotseat: source.hotseat,
        ownerId: user.id,
        config: $state.snapshot(source.config)
    }
}

function isUsersSeat(source: Game, player: Player, user: User) {
    return source.hotseat ? player.name === user.username : player.userId === user.id
}

function continuedPlayer(source: Game, player: Player): Player {
    return {
        id: nanoid(),
        isHuman: player.isHuman,
        ...(source.hotseat || !player.userId ? {} : { userId: player.userId }),
        name: player.name,
        status: player.name ? PlayerStatus.Reserved : PlayerStatus.Open
    }
}
