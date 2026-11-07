import { flushSync } from 'svelte'
import {
    ActionSource,
    assert,
    assertExists,
    GameEngine,
    GameNotificationAction,
    GameStorage,
    GameSyncStatus,
    NotificationCategory,
    PlayerStatus,
    Visibility,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    NotificationChannel,
    NotificationEventType,
    createHarnessAppContext,
    type GameUiDefinition,
    type HarnessAppContext
} from '@tabletop/frontend-components'
import {
    ActionType,
    Definition,
    FeudumGameStateValidator,
    FeudumRuntime,
    MachineState,
    startingPawnOffers,
    HydratedFeudumGameState,
    type FeudumGameState,
    type FeudumProjectedState,
    type Good
} from '@tabletop/feudum'
import { UiDefinition } from '$lib/definitions/definition.js'
import { FeudumUiRuntime } from '$lib/definitions/runtime.js'
import { FeudumGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...FeudumRuntime,
            sessionClass: GameSession,
            colorizer: FeudumUiRuntime.colorizer,
            gameUI: {
                load: async () => {
                    throw Error('The session harness does not render a table')
                },
                mount: () => {
                    throw Error('The session harness does not render a table')
                }
            }
        }
    }
}

const HARNESS_USER = 'harness-user'
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const engine = new GameEngine(FeudumRuntime)

function canonical(state: FeudumProjectedState): FeudumGameState {
    assert(FeudumGameStateValidator.Check(state), 'The host holds the canonical state')
    return state
}

/** Its first synchronisation, or the transition or History step under way, has finished. */
export async function settled(session: FeudumGameSession) {
    do {
        await new Promise((resolve) => setTimeout(resolve))
    } while (session.busy || session.updatingVisibleState)
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

interface OpenSeat {
    readonly playerId: string
    readonly session: FeudumGameSession
    readonly appContext: HarnessAppContext
    readonly bridgedContext: BridgedContext
}

type HostMove = Record<string, unknown> & { type: ActionType }

/**
 * The server, in a spec: it holds the canonical game and gives each open seat the real session, on
 * its own projected state, with the same notifications and responses the server's would be. A seat
 * that sends is heard by the others; `sendUnheard` and `reconcile` give a real reconciliation.
 */
export class FeudumHost {
    readonly game: Game
    state: FeudumGameState
    actions: GameAction[] = []
    /** The Actions a session handed to the server, by seat. */
    readonly sent = new Map<string, GameAction[]>()

    private readonly seats = new Map<string, OpenSeat>()
    private hostSends = 0

    constructor(numPlayers = 4) {
        const game: Game = {
            ...FeudumRuntime.initializer.initializeGame(
                {
                    id: 'feudum-session',
                    typeId: Definition.info.id,
                    ownerId: 'owner',
                    seed: 7,
                    config: {},
                    players: Array.from({ length: numPlayers }, (_, index) => ({
                        id: `p${index + 1}`,
                        name: `Player ${index + 1}`,
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }))
                },
                Definition
            ),
            hotseat: false,
            storage: GameStorage.Remote
        }
        const { startedGame, initialState } = engine.startGame(game, {
            masterSeed: MASTER_SEED,
            startingPositions: { playerIds: game.players.map(({ id }) => id) }
        })
        this.game = startedGame
        this.state = canonical(initialState)
    }

    get order(): string[] {
        return this.state.turnManager.turnOrder
    }

    get setupSeat(): string {
        const playerId = this.state.flow.setupOrder?.playerId
        assertExists(playerId, 'A seat is setting up')
        return playerId
    }

    /** Arranges the table, as a fixture does, before the seats that see it open. */
    edit(change: (state: HydratedFeudumGameState) => void) {
        const state = new HydratedFeudumGameState(structuredClone(this.state))
        change(state)
        this.state = canonical(state.dehydrate())
    }

    private perspective(playerId: string): Visibility.Perspective {
        return { kind: 'player', playerId }
    }

    /** The game as this seat's client holds it: the harness's user sits in this seat alone. */
    private gameFor(playerId: string): Game {
        const { state: _state, ...game } = structuredClone(this.game)
        return {
            ...game,
            activePlayerIds: [...this.state.activePlayerIds],
            players: game.players.map((player) => {
                const { userId: _userId, ...seat } = player
                return player.id === playerId ? { ...seat, userId: HARNESS_USER } : seat
            })
        }
    }

    private history(playerId: string) {
        return Visibility.projectActionHistory({
            currentState: this.state,
            actions: this.actions,
            visibility: FeudumRuntime.visibility,
            perspective: this.perspective(playerId),
            replay: { game: this.game, runtime: FeudumRuntime }
        })
    }

    /** A seat's own browser, with a session listening to the game. */
    async openSeat(playerId: string): Promise<FeudumGameSession> {
        this.closeSeat(playerId)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        this.serve(appContext, playerId)
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: this.game.id
        })
        const history = this.history(playerId)
        const session = new FeudumGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FeudumUiRuntime,
            game: this.gameFor(playerId),
            state: history.currentState,
            actions: [...history.actions]
        })
        this.seats.set(playerId, { playerId, session, appContext, bridgedContext })
        session.listenToGame()
        await settled(session)
        return session
    }

    private serve(appContext: HarnessAppContext, playerId: string) {
        Object.assign(appContext.api, {
            applyAction: async (_game: Game, action: GameAction) => {
                this.sent.set(playerId, [...(this.sent.get(playerId) ?? []), action])
                const result = this.execute(action)
                await this.tellOthers(playerId, result)
                return {
                    actions: this.projectResult(result, playerId),
                    game: this.gameFor(playerId)
                }
            },
            undoAction: async (_game: Game, actionId: string) => {
                const startIndex = this.undo(actionId)
                await this.tellOthersOfUndo(playerId, startIndex)
                return this.replayFor(playerId, startIndex)
            },
            checkSync: async (_gameId: string, checksum: number) => ({
                status:
                    checksum === this.state.actionChecksum
                        ? GameSyncStatus.InSync
                        : GameSyncStatus.OutOfSync,
                actions: [...this.history(playerId).actions],
                checksum: this.state.actionChecksum
            }),
            getGame: async () => {
                const history = this.history(playerId)
                return {
                    game: { ...this.gameFor(playerId), state: history.currentState },
                    actions: [...history.actions]
                }
            }
        } satisfies Partial<HarnessAppContext['api']>)
    }

    private execute(action: GameAction) {
        const result = engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action
        })
        this.state = canonical(result.updatedState)
        this.actions.push(...result.processedActions)
        return result
    }

    private projectResult(result: ReturnType<FeudumHost['execute']>, playerId: string) {
        return Visibility.projectActionResult({
            result,
            visibility: FeudumRuntime.visibility,
            perspective: this.perspective(playerId),
            replay: { game: this.game, runtime: FeudumRuntime }
        }).processedActions
    }

    private undo(actionId: string): number {
        const position = this.actions.findIndex(({ id }) => id === actionId)
        const target = this.actions[position]
        assertExists(target, `The host holds Action ${actionId}`)
        assertExists(target.index, `Action ${actionId} has an index`)
        for (const action of this.actions.slice(position).toReversed()) {
            this.state = canonical(engine.undoProcessedAction({ action, state: this.state }))
        }
        this.actions.splice(position)
        return target.index
    }

    private replayFor(playerId: string, startIndex: number) {
        const perspective = this.perspective(playerId)
        const history = Visibility.projectActionHistory({
            currentState: this.state,
            actions: [],
            startIndex,
            visibility: FeudumRuntime.visibility,
            perspective,
            replay: { game: this.game, runtime: FeudumRuntime }
        })
        const actionReplay = { startIndex: history.startIndex, actions: [...history.actions] }
        return {
            game: this.gameFor(playerId),
            redoneActions: [],
            actionReplay,
            canonicalReplay: { ...actionReplay, userActions: [] },
            checksum: this.state.actionChecksum,
            perspective
        }
    }

    private async tellOthers(
        sender: string | undefined,
        result: ReturnType<FeudumHost['execute']>
    ) {
        for (const { playerId, appContext, session } of this.seats.values()) {
            if (playerId !== sender) {
                await appContext.notificationService.emit({
                    eventType: NotificationEventType.Data,
                    channel: NotificationChannel.User,
                    notification: {
                        id: `added-${this.state.actionCount}-${playerId}`,
                        type: NotificationCategory.Game,
                        action: GameNotificationAction.AddProjectedActions,
                        data: {
                            game: this.gameFor(playerId),
                            actions: this.projectResult(result, playerId),
                            perspective: this.perspective(playerId)
                        }
                    }
                })
                await settled(session)
            }
        }
    }

    private async tellOthersOfUndo(sender: string, startIndex: number) {
        for (const { playerId, appContext, session } of this.seats.values()) {
            if (playerId !== sender) {
                const { game, actionReplay, checksum, perspective } = this.replayFor(
                    playerId,
                    startIndex
                )
                await appContext.notificationService.emit({
                    eventType: NotificationEventType.Data,
                    channel: NotificationChannel.User,
                    notification: {
                        id: `replaced-${this.state.actionCount}-${playerId}`,
                        type: NotificationCategory.Game,
                        action: GameNotificationAction.ReplaceProjectedActions,
                        data: { game, actionReplay, checksum, perspective }
                    }
                })
                await settled(session)
            }
        }
    }

    private hostAction(playerId: string, move: HostMove): GameAction {
        this.hostSends += 1
        return {
            id: `host-${this.hostSends}`,
            gameId: this.game.id,
            source: ActionSource.User,
            playerId,
            ...move
        }
    }

    /** A seat acts from another browser: every open seat hears it, that seat's own included. */
    async send(playerId: string, move: HostMove) {
        await this.tellOthers(undefined, this.execute(this.hostAction(playerId, move)))
    }

    /** A seat acts while the open seats' connections are down, so nobody hears it. */
    sendUnheard(playerId: string, move: HostMove) {
        this.execute(this.hostAction(playerId, move))
    }

    /** The seat's connection comes back: it finds it is out of date and catches up. */
    async reconcile(playerId: string) {
        const seat = this.seats.get(playerId)
        assertExists(seat, `Seat ${playerId} is open`)
        await seat.appContext.notificationService.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.User
        })
        await settled(seat.session)
    }

    /** R-1.4.8 Every seat left in the goods step takes these, in setup order. */
    async playStartingGoods(
        goodsOf: (playerId: string) => { goods: Good[]; sulfurToBarrel?: boolean } = () => ({
            goods: ['saltpeter', 'sulfur', 'iron']
        }),
        seats = Number.POSITIVE_INFINITY
    ) {
        for (let played = 0; played < seats; played += 1) {
            if (this.state.machineState !== MachineState.ChoosingStartingGoods) {
                return
            }
            const playerId = this.setupSeat
            await this.send(playerId, {
                type: ActionType.ChooseStartingGoods,
                ...goodsOf(playerId)
            })
        }
    }

    /** R-1.4.9 This many seats left in the pawn step place a pawn, each its first offer. */
    async playStartingPawns(seats = Number.POSITIVE_INFINITY) {
        for (let played = 0; played < seats; played += 1) {
            if (this.state.machineState !== MachineState.PlacingStartingPawn) {
                return
            }
            const playerId = this.setupSeat
            const offers = startingPawnOffers(new HydratedFeudumGameState(this.state), playerId)
            await this.send(playerId, {
                type: ActionType.PlaceStartingPawn,
                character: offers.characters[0].character,
                spaceId: offers.spaces[0]
            })
        }
    }

    close() {
        for (const playerId of [...this.seats.keys()]) {
            this.closeSeat(playerId)
        }
    }

    /** A seat's browser closing. The harness's notification service is shared by every session. */
    private closeSeat(playerId: string) {
        const seat = this.seats.get(playerId)
        if (seat) {
            seat.session.stopListeningToGame()
            seat.session.dispose()
            seat.bridgedContext.dispose()
            this.seats.delete(playerId)
        }
    }
}
