import {
    ActionSource,
    assert,
    assertExists,
    findPlayerForUserId,
    type ActionCascadeResult,
    type CanonicalActionReplay,
    type Game,
    type GameAction,
    type GameRuntime,
    type GameState,
    type GameWithoutState,
    GameSyncStatus,
    GameEngine,
    omitGameState,
    type ProcessedActionReplay,
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
    readonly game: GameWithoutState
    readonly actions: GameAction[]
    readonly missingActions: GameAction[] | undefined
    readonly perspective: Visibility.Perspective | undefined
}

export interface GameSyncRepresentation {
    readonly status: GameSyncStatus
    readonly actions: GameAction[]
    readonly checksum: number
}

export interface UndoResultsRepresentation {
    readonly game: GameWithoutState
    readonly actionReplay: ProcessedActionReplay
    readonly canonicalReplay: CanonicalActionReplay
    readonly checksum: number
    readonly undoneActions?: GameAction[]
    readonly redoneActions?: GameAction[]
    readonly perspective: Visibility.Perspective | undefined
}

export function createGameRepresentationEtag({
    canonicalEtag,
    game,
    hostView = false,
    visibility: registeredVisibility,
    user
}: {
    canonicalEtag: string
    game: Game
    hostView?: boolean
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): string {
    const visibility = Visibility.getGameVisibility(game, { visibility: registeredVisibility })
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
    runtime,
    visibility: registeredVisibility,
    user
}: {
    game: Game
    actions: GameAction[]
    hostView?: boolean
    runtime?: GameRuntime
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): GameRepresentation {
    const visibility = Visibility.getGameVisibility(game, { visibility: registeredVisibility })
    if (game.state !== undefined && runtime !== undefined) {
        new GameEngine(runtime).validateCanonicalState(game.state)
    }
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
        perspective,
        replay: createActionReplayContext(game, runtime)
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
    runtime,
    visibility: registeredVisibility,
    user
}: {
    game: Game
    status: GameSyncStatus
    actions: GameAction[]
    runtime?: GameRuntime
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): GameSyncRepresentation {
    const visibility = Visibility.getGameVisibility(game, { visibility: registeredVisibility })
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
        perspective: derivePerspective({ game, user }),
        replay: createActionReplayContext(game, runtime)
    })

    return {
        status,
        actions: [...history.actions],
        checksum: currentState.actionChecksum
    }
}

export function createUndoResultsRepresentation({
    game,
    actionReplay,
    undoneActions,
    redoneActions,
    runtime,
    visibility: registeredVisibility,
    user
}: {
    game: Game
    actionReplay: ProcessedActionReplay
    undoneActions: GameAction[]
    redoneActions: GameAction[]
    runtime?: GameRuntime
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): UndoResultsRepresentation {
    const visibility = Visibility.getGameVisibility(game, { visibility: registeredVisibility })
    if (game.hotseat || visibility === undefined) {
        return {
            game: omitGameState(game),
            actionReplay,
            canonicalReplay: createLegacyCompatibleReplay(actionReplay),
            checksum: requireGameState(game).actionChecksum,
            undoneActions,
            redoneActions,
            perspective: undefined
        }
    }

    return createUndoResultsRepresentationForPerspective({
        game,
        actionReplay,
        redoneActions,
        runtime,
        visibility,
        perspective: derivePerspective({ game, user })
    })
}

export function createUndoResultsRepresentationForPerspective({
    game,
    actionReplay,
    redoneActions,
    runtime,
    visibility,
    perspective
}: {
    game: Game
    actionReplay: ProcessedActionReplay
    redoneActions: GameAction[]
    runtime?: GameRuntime
    visibility: Visibility.GameVisibility<GameState>
    perspective: Visibility.Perspective
}): UndoResultsRepresentation {
    const currentState = requireGameState(game)
    const projectedHistory = Visibility.projectActionHistory({
        currentState,
        actions: actionReplay.actions,
        startIndex: actionReplay.startIndex,
        visibility,
        perspective,
        replay: createActionReplayContext(game, runtime)
    })
    const projectedReplay: ProcessedActionReplay = {
        startIndex: projectedHistory.startIndex,
        actions: [...projectedHistory.actions]
    }
    const projectedActionsById = new Map(
        projectedReplay.actions.map((action) => [action.id, action])
    )
    const projectedRedoneActions = redoneActions.map((action) => {
        const projectedAction = projectedActionsById.get(action.id)
        assertExists(projectedAction, `Redone Action ${action.id} is absent from the replay suffix`)
        return projectedAction
    })

    return {
        game: omitGameState(game),
        actionReplay: projectedReplay,
        canonicalReplay: createLegacyCompatibleReplay(projectedReplay),
        checksum: currentState.actionChecksum,
        redoneActions: projectedRedoneActions,
        perspective
    }
}

export function createActionResultsRepresentation({
    game,
    result,
    storedActions,
    missingActions,
    priorState,
    runtime,
    visibility: registeredVisibility,
    user
}: {
    game: Game
    result: ActionCascadeResult
    storedActions: GameAction[]
    missingActions: GameAction[]
    priorState: GameState
    runtime?: GameRuntime
    visibility?: Visibility.GameVisibility<GameState>
    user: User
}): ActionResultsRepresentation {
    const visibility = Visibility.getGameVisibility(game, { visibility: registeredVisibility })
    if (game.hotseat || visibility === undefined) {
        const orderedMissingActions = orderActions(missingActions)
        return {
            game: omitGameState(game),
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
        runtime,
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
    runtime,
    visibility,
    perspective
}: {
    game: Game
    result: ActionCascadeResult
    storedActions: GameAction[]
    missingActions: GameAction[]
    priorState: GameState
    runtime?: GameRuntime
    visibility: Visibility.GameVisibility<GameState>
    perspective: Visibility.Perspective
}): ActionResultsRepresentation {
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
        perspective,
        replay: createActionReplayContext(game, runtime)
    })

    let projectedMissingActions: GameAction[] | undefined
    if (orderedMissingActions.length > 0) {
        const history = Visibility.projectActionHistory({
            currentState: priorState,
            actions: orderedMissingActions,
            startIndex: priorState.actionCount - orderedMissingActions.length,
            visibility,
            perspective,
            replay: createActionReplayContext(game, runtime)
        })
        projectedMissingActions = [...history.actions]
    }

    return {
        game: omitGameState(game),
        actions: projectedResult.processedActions,
        missingActions: projectedMissingActions,
        perspective
    }
}

function requireGameState(game: Game): GameState {
    const state = game.state
    assertExists(state, `Cannot represent Game ${game.id} without current state`)
    return state
}

function createLegacyCompatibleReplay(actionReplay: ProcessedActionReplay): CanonicalActionReplay {
    return {
        startIndex: actionReplay.startIndex,
        actions: actionReplay.actions,
        userActions: actionReplay.actions
            .filter((action) => action.source === ActionSource.User)
            .map((action) => {
                const legacyAction = structuredClone(action)
                delete legacyAction.undoPatch
                return legacyAction
            })
    }
}

function orderActions(actions: GameAction[]): GameAction[] {
    return actions.toSorted((left, right) => (left.index ?? 0) - (right.index ?? 0))
}

function createActionReplayContext(
    game: Game,
    runtime?: GameRuntime
): Visibility.ActionReplayContext | undefined {
    return runtime === undefined ? undefined : { game, runtime }
}

function derivePerspective({ game, user }: { game: Game; user: User }): Visibility.Perspective {
    const player = findPlayerForUserId(game, user.id)
    if (player === undefined) {
        return { kind: 'spectator' }
    }
    return { kind: 'player', playerId: player.id }
}
