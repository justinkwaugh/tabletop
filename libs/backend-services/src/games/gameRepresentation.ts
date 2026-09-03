import {
    assert,
    findPlayerForUserId,
    type Game,
    type GameAction,
    type GameState,
    type User,
    Visibility
} from '@tabletop/common'
import { createHash } from 'node:crypto'

export interface GameRepresentation {
    readonly game: Game
    readonly actions: GameAction[]
    readonly perspective: Visibility.Perspective | undefined
}

export function createGameRepresentationEtag({
    canonicalEtag,
    game,
    hostView = false,
    visibility,
    user
}: {
    canonicalEtag: string
    game: Game
    hostView?: boolean
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): string {
    if (hostView || visibility === undefined) {
        return canonicalEtag
    }

    const perspective = derivePerspective({ game, user })
    const perspectiveKey =
        perspective.kind === 'player' ? `player:${perspective.playerId}` : 'spectator'
    return createHash('sha256')
        .update(canonicalEtag)
        .update('\0')
        .update(perspectiveKey)
        .digest('base64url')
}

export function createGameRepresentation({
    game,
    actions,
    hostView = false,
    visibility,
    user
}: {
    game: Game
    actions: GameAction[]
    hostView?: boolean
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): GameRepresentation {
    if (hostView || visibility === undefined) {
        return { game, actions, perspective: undefined }
    }

    const perspective = derivePerspective({ game, user })
    if (game.state === undefined) {
        assert(
            actions.length === 0,
            `Cannot project Game ${game.id} Action History without its current state`
        )
        return { game: structuredClone(game), actions: [], perspective }
    }

    const history = Visibility.projectActionHistory({
        currentState: game.state,
        actions,
        visibility,
        perspective
    })
    const projectedGame = structuredClone(game)
    projectedGame.state = history.currentState

    return {
        game: projectedGame,
        actions: [...history.actions],
        perspective
    }
}

function derivePerspective({ game, user }: { game: Game; user: User }): Visibility.Perspective {
    const player = findPlayerForUserId(game, user.id)
    if (player === undefined) {
        return { kind: 'spectator' }
    }
    return { kind: 'player', playerId: player.id }
}
