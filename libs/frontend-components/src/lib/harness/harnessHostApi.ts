import {
    ActionSource,
    assert,
    assertExists,
    GameEngine,
    GameStatus,
    GameSyncStatus,
    omitGameState,
    Visibility,
    type Game,
    type GameAction,
    type GameRuntime,
    type GameState
} from '@tabletop/common'
import type { GetGameOptions } from '$lib/network/tabletopApi.svelte.js'
import type { GameService } from '$lib/services/gameService.js'
import { DummyRemoteApiService } from './dummyRemoteApiService.js'

export class HarnessHostApi extends DummyRemoteApiService {
    private readonly engine: GameEngine
    private hostView = false

    constructor(
        private readonly gameService: Pick<GameService, 'loadGame' | 'saveGameLocally'>,
        private readonly runtime: GameRuntime,
        private readonly perspective: Visibility.Perspective
    ) {
        super()
        assertExists(runtime.visibility, 'Protected mode requires a visibility definition')
        this.engine = new GameEngine(runtime)
    }

    async getGame(gameId: string, options?: GetGameOptions) {
        const { game, state, actions } = await this.load(gameId)
        this.hostView = options?.hostView === true
        if (this.hostView) return { game: { ...game, state }, actions }
        const history = this.projectHistory(game, state, actions)
        return { game: { ...game, state: history.currentState }, actions: [...history.actions] }
    }

    async applyAction(clientGame: Game, action: GameAction) {
        const { game, state, actions } = await this.load(clientGame.id)
        assert(action.gameId === game.id, 'Action belongs to another game')
        assert(action.source === ActionSource.User, 'Only player actions may be submitted')
        assert(action.index === state.actionCount, 'Action does not match the current position')
        assert(
            this.hostView ||
                (this.perspective.kind === 'player' &&
                    action.playerId === this.perspective.playerId),
            'Action belongs to another player'
        )
        const result = this.engine.executeCanonicalAction({ game, state, action })
        const now = new Date()
        for (const processed of result.processedActions) processed.createdAt = now
        const updatedGame = this.updatedGame(game, result.updatedState, action)
        const projected = this.hostView
            ? result
            : Visibility.projectActionResult({
                  result,
                  visibility: this.visibility,
                  perspective: this.perspective,
                  replay: { game: updatedGame, runtime: this.runtime }
              })
        await this.gameService.saveGameLocally({
            game: updatedGame,
            state: result.updatedState,
            actions: [...actions, ...result.processedActions]
        })
        return {
            game: updatedGame,
            actions: projected.processedActions,
            perspective: this.perspective
        }
    }

    async undoAction(clientGame: Game, actionId: string) {
        const { game, state, actions } = await this.load(clientGame.id)
        const targetIndex = actions.findIndex((action) => action.id === actionId)
        const target = actions[targetIndex]
        assertExists(target, 'Undo action is unavailable')
        assert(target.source === ActionSource.User, 'Only player actions may be undone')
        const suffix = actions.slice(targetIndex)
        const sameGroup = (action: GameAction) =>
            target.simultaneousGroupId !== undefined &&
            target.simultaneousGroupId === action.simultaneousGroupId
        if (!this.hostView) {
            assert(
                this.perspective.kind === 'player' && target.playerId === this.perspective.playerId,
                'Cannot undo another player’s action'
            )
            assert(!suffix.some((action) => action.revealsInfo), 'Cannot undo revealed information')
            assert(
                suffix.every(
                    (action) =>
                        action.source === ActionSource.System ||
                        action.playerId === target.playerId ||
                        sameGroup(action)
                ),
                'Cannot undo across another player’s turn'
            )
        }
        let restored = state
        for (const action of suffix.toReversed()) {
            restored = this.engine.undoProcessedAction({ state: restored, action })
        }
        this.engine.validateCanonicalState(restored)
        const retained = actions.slice(0, targetIndex)
        for (const action of suffix.slice(1)) {
            if (
                action.source !== ActionSource.User ||
                action.playerId === target.playerId ||
                !sameGroup(action)
            )
                continue
            const redo = structuredClone(action)
            delete redo.index
            delete redo.undoPatch
            const result = this.engine.executeCanonicalAction({
                game,
                state: restored,
                action: redo
            })
            restored = result.updatedState
            retained.push(...result.processedActions)
        }
        const updatedGame = this.updatedGame(game, restored, retained.at(-1))
        const history = this.hostView
            ? { actions: retained }
            : this.projectHistory(updatedGame, restored, retained)
        const actionReplay = { startIndex: 0, actions: [...history.actions] }
        await this.gameService.saveGameLocally({
            game: updatedGame,
            state: restored,
            actions: retained
        })
        return {
            game: updatedGame,
            actionReplay,
            canonicalReplay: {
                ...actionReplay,
                userActions: actionReplay.actions
                    .filter((action) => action.source === ActionSource.User)
                    .map((action) => {
                        const copy = structuredClone(action)
                        delete copy.undoPatch
                        return copy
                    })
            },
            checksum: restored.actionChecksum,
            perspective: this.perspective
        }
    }

    async checkSync(gameId: string, checksum: number, index: number) {
        const { state } = await this.load(gameId)
        return {
            status:
                checksum === state.actionChecksum && index === state.actionCount - 1
                    ? GameSyncStatus.InSync
                    : GameSyncStatus.OutOfSync,
            actions: [],
            checksum: state.actionChecksum
        }
    }

    private get visibility() {
        const visibility = this.runtime.visibility
        assertExists(visibility, 'Protected mode requires a visibility definition')
        return visibility
    }

    private async load(gameId: string) {
        const { game, actions } = await this.gameService.loadGame(gameId)
        assertExists(game, 'Local game is unavailable')
        const state = game.state
        assertExists(state, 'Local game has no state')
        this.engine.validateCanonicalState(state)
        return { game: omitGameState(game), state, actions }
    }

    private projectHistory(game: Game, state: GameState, actions: GameAction[]) {
        return Visibility.projectActionHistory({
            currentState: state,
            actions,
            visibility: this.visibility,
            perspective: this.perspective,
            replay: { game, runtime: this.runtime }
        })
    }

    private updatedGame(game: Game, state: GameState, lastAction?: GameAction): Game {
        return {
            ...game,
            activePlayerIds: [...state.activePlayerIds],
            status: state.result ? GameStatus.Finished : GameStatus.Started,
            result: state.result,
            winningPlayerIds: [...state.winningPlayerIds],
            finishedAt: state.result ? (game.finishedAt ?? new Date()) : undefined,
            updatedAt: new Date(),
            lastActionAt: lastAction?.createdAt,
            lastActionPlayerId: lastAction?.playerId
        }
    }
}
