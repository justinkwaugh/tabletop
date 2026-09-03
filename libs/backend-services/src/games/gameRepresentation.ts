import {
    assert,
    assertExists,
    findPlayerForUserId,
    type ActionCascadeResult,
    type Game,
    type GameAction,
    type GameState,
    GameSyncStatus,
    type User,
    Visibility
} from '@tabletop/common'
import { createHash } from 'node:crypto'

export interface GameRepresentation {
    readonly game: Game
    readonly actions: GameAction[]
    readonly perspective: Visibility.Perspective | undefined
}

export interface ActionResultsRepresentation {
    readonly game: Game
    readonly actions: GameAction[]
    readonly missingActions: GameAction[] | undefined
    readonly perspective: Visibility.Perspective | undefined
}

export interface GameSyncRepresentation {
    readonly status: GameSyncStatus
    readonly actions: GameAction[]
    readonly checksum: number
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
    if (hostView || game.hotseat || visibility === undefined) {
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
    if (hostView || game.hotseat || visibility === undefined) {
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

export function createGameSyncRepresentation({
    game,
    status,
    actions,
    visibility,
    user
}: {
    game: Game
    status: GameSyncStatus
    actions: GameAction[]
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): GameSyncRepresentation {
    const currentState = game.state
    assertExists(currentState, `Cannot represent synchronization for Game ${game.id} without state`)

    if (game.hotseat || visibility === undefined) {
        return { status, actions, checksum: currentState.actionChecksum }
    }

    const history = Visibility.projectActionHistory({
        currentState,
        actions,
        startIndex: currentState.actionCount - actions.length,
        visibility,
        perspective: derivePerspective({ game, user })
    })

    return {
        status,
        actions: [...history.actions],
        checksum: currentState.actionChecksum
    }
}

export function createActionResultsRepresentation({
    game,
    result,
    storedActions,
    missingActions,
    priorState,
    visibility,
    user
}: {
    game: Game
    result: ActionCascadeResult
    storedActions: GameAction[]
    missingActions: GameAction[]
    priorState: GameState
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): ActionResultsRepresentation {
    if (game.hotseat || visibility === undefined) {
        const representedGame = structuredClone(game)
        delete representedGame.state
        const orderedMissingActions = orderActions(missingActions)
        return {
            game: representedGame,
            actions: storedActions,
            missingActions: orderedMissingActions.length > 0 ? orderedMissingActions : undefined,
            perspective: undefined
        }
    }

    return createActionResultsRepresentationForPerspective({
        game,
        result,
        storedActions,
        missingActions,
        priorState,
        visibility,
        perspective: derivePerspective({ game, user })
    })
}

export function createActionResultsRepresentationForPerspective({
    game,
    result,
    storedActions,
    missingActions,
    priorState,
    visibility,
    perspective
}: {
    game: Game
    result: ActionCascadeResult
    storedActions: GameAction[]
    missingActions: GameAction[]
    priorState: GameState
    visibility: Visibility.GameVisibility<GameState>
    perspective: Visibility.Perspective
}): ActionResultsRepresentation {
    const representedGame = structuredClone(game)
    delete representedGame.state
    const orderedMissingActions = orderActions(missingActions)

    assert(
        result.actionCascade.before.actionCount === priorState.actionCount &&
            result.actionCascade.before.actionChecksum === priorState.actionChecksum,
        'Canonical Action cascade does not begin at the persisted prior state'
    )

    const storedActionsById = new Map(storedActions.map((action) => [action.id, action]))
    assert(
        storedActions.length === result.actionCascade.transitions.length &&
            storedActionsById.size === result.actionCascade.transitions.length,
        'Stored Actions do not match the canonical Action cascade'
    )
    const storedTransitions = result.actionCascade.transitions.map((transition) => {
        const storedAction = storedActionsById.get(transition.action.id)
        assertExists(storedAction, `Canonical Action ${transition.action.id} was not stored`)
        return { action: storedAction, after: transition.after }
    })
    const storedResult: ActionCascadeResult = {
        processedActions: storedTransitions.map((transition) => transition.action),
        updatedState: result.updatedState,
        indexOffset: result.indexOffset,
        actionCascade: {
            before: result.actionCascade.before,
            transitions: storedTransitions
        }
    }
    const projectedResult = Visibility.projectActionResult({
        result: storedResult,
        visibility,
        perspective
    })

    let projectedMissingActions: GameAction[] | undefined
    if (orderedMissingActions.length > 0) {
        const history = Visibility.projectActionHistory({
            currentState: priorState,
            actions: orderedMissingActions,
            startIndex: priorState.actionCount - orderedMissingActions.length,
            visibility,
            perspective
        })
        projectedMissingActions = [...history.actions]
    }

    return {
        game: representedGame,
        actions: projectedResult.processedActions,
        missingActions: projectedMissingActions,
        perspective
    }
}

function orderActions(actions: GameAction[]): GameAction[] {
    return actions.toSorted((left, right) => (left.index ?? 0) - (right.index ?? 0))
}

function derivePerspective({ game, user }: { game: Game; user: User }): Visibility.Perspective {
    const player = findPlayerForUserId(game, user.id)
    if (player === undefined) {
        return { kind: 'spectator' }
    }
    return { kind: 'player', playerId: player.id }
}
