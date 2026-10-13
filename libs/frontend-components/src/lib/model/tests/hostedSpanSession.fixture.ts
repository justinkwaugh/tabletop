import {
    ActionSource,
    GameEngine,
    GameNotificationAction,
    GameStorage,
    GameSyncStatus,
    NotificationCategory,
    Visibility,
    assertExists,
    calculateActionChecksum,
    isRestingInSpan,
    restingSpan,
    sameHistoryPosition,
    unmergedPlayerIds,
    type ActionHistoryPosition,
    type Game,
    type GameAction,
    type UnmergedBranch
} from '@tabletop/common'
import {
    spanAction,
    spanGameInfo,
    summary,
    type SpanGameOptions
} from '@tabletop/common/test-fixtures/span-game'
import { SpanHost, type SpanHostSubmission } from '@tabletop/common/test-fixtures/span-host'
import { GameActionResults } from '../gameActionResults.svelte.js'
import { createBranchContext, JoinedBranchHistory } from '../gameBranch.js'
import { GameContext } from '../gameContext.svelte.js'
import { GameUndo } from '../gameUndo.js'
import { BridgedContext } from '../../services/bridges/bridgedContext.svelte.js'
import { HarnessLibraryService } from '../../harness/harnessLibraryService.js'
import { HarnessGameService } from '../../harness/harnessGameService.svelte.js'
import { HarnessChatService } from '../../harness/harnessChatService.svelte.js'
import { DummyNotificationService } from '../../harness/dummyNotificationService.js'
import { DummyRemoteApiService } from '../../harness/dummyRemoteApiService.js'
import { NotificationChannel, NotificationEventType } from '../../services/notificationService.js'
import type { GetGameOptions } from '../../network/tabletopApi.svelte.js'
import { Authorization, settle } from './privateHandSession.fixture.js'
import { SpanSession, spanUiRuntime } from './spanSession.js'

class Notifications extends DummyNotificationService {
    readonly synchronizesOnSubscribe = false
    isUserChannelReady() {
        return false
    }
}

class Remote extends DummyRemoteApiService {
    readonly perspective: Visibility.Perspective
    onMainLine?: (submission: SpanHostSubmission) => Promise<void>
    onBranch?: (unmergedBranch: UnmergedBranch, undoneActionIds?: string[]) => Promise<void>
    onReplaced?: (startIndex: number) => Promise<void>
    pendingAcceptance?: Promise<void>
    syncChecks = 0

    constructor(
        private readonly host: SpanHost,
        private readonly playerId: string
    ) {
        super()
        this.perspective = host.game.players.some((player) => player.id === playerId)
            ? { kind: 'player', playerId }
            : { kind: 'spectator' }
    }

    private get visibility() {
        const visibility = this.host.runtime.visibility
        assertExists(visibility, 'The span fixture defines visibility')
        return visibility
    }

    private mainLineHistory() {
        return Visibility.projectActionHistory({
            game: this.host.game,
            currentState: this.host.state,
            actions: this.host.actions,
            perspective: this.perspective,
            visibility: this.visibility,
            replay: { game: this.host.game, runtime: this.host.runtime }
        })
    }

    project(record: UnmergedBranch | undefined): UnmergedBranch | undefined {
        return (
            record &&
            Visibility.projectUnmergedBranch({
                game: this.host.game,
                state: this.host.state,
                ...record,
                visibility: this.visibility
            })
        )
    }

    private ownBranch(): UnmergedBranch | undefined {
        const state = this.host.state
        return isRestingInSpan(state) &&
            unmergedPlayerIds(restingSpan(state)).includes(this.playerId)
            ? this.host.unmergedBranch(this.playerId)
            : undefined
    }

    async getGame(_gameId: string, options?: GetGameOptions) {
        const history = this.mainLineHistory()
        const includeActions = options?.includeActions !== false
        const own = this.ownBranch()
        return {
            game: { ...structuredClone(this.host.game), state: history.currentState },
            actions: includeActions ? [...history.actions] : [],
            historyComplete: includeActions,
            unmergedBranch: this.project(own && (includeActions ? own : { ...own, actions: [] }))
        }
    }

    async checkSync(
        _gameId: string,
        checksum: number,
        index: number,
        branchPosition?: ActionHistoryPosition
    ) {
        this.syncChecks += 1
        const missed = this.mainLineHistory().actions.filter(
            (action) => (action.index ?? 0) > index
        )
        const continues =
            calculateActionChecksum(checksum, missed) === this.host.state.actionChecksum
        const own = this.ownBranch()
        const inStep =
            own !== undefined &&
            branchPosition !== undefined &&
            sameHistoryPosition(own.branch, branchPosition)
        return {
            status: continues ? GameSyncStatus.InSync : GameSyncStatus.OutOfSync,
            actions: continues ? missed : [],
            checksum: this.host.state.actionChecksum,
            branchSync:
                own === undefined && branchPosition === undefined
                    ? undefined
                    : inStep
                      ? { status: GameSyncStatus.InSync }
                      : { status: GameSyncStatus.OutOfSync, unmergedBranch: this.project(own) }
        }
    }

    projectMainLine(submission: SpanHostSubmission): GameAction[] {
        if (submission.mainLine === undefined) return []
        return [
            ...Visibility.projectActionCascade(submission.mainLine.actionCascade, {
                visibility: this.visibility,
                perspective: this.perspective,
                replay: { game: this.host.game, runtime: this.host.runtime }
            }).actions
        ]
    }

    async applyAction(_game: Game, action: GameAction) {
        await this.pendingAcceptance
        const submission = this.host.submit(action)
        const unmergedBranch = this.project(submission.unmergedBranch)
        await this.onMainLine?.(submission)
        if (
            unmergedBranch !== undefined &&
            (submission.mainLine === undefined || unmergedBranch.branch.closed)
        ) {
            await this.onBranch?.(unmergedBranch)
        }
        return {
            game: structuredClone(this.host.game),
            actions: this.projectMainLine(submission),
            perspective: this.perspective,
            unmergedBranch
        }
    }

    replayFrom(startIndex: number) {
        const history = Visibility.projectActionHistory({
            game: this.host.game,
            currentState: this.host.state,
            actions: this.host.actions.slice(startIndex),
            startIndex,
            perspective: this.perspective,
            visibility: this.visibility,
            replay: { game: this.host.game, runtime: this.host.runtime }
        })
        return { startIndex, actions: [...history.actions] }
    }

    async undoAction(_game: Game, actionId: string) {
        const checksumBefore = this.host.state.actionChecksum
        const undone = this.host.undoInBranch(this.playerId, actionId)
        const unmergedBranch = this.project(undone.unmergedBranch)
        const actionReplay = this.replayFrom(undone.replay.startIndex)
        if (this.host.state.actionChecksum !== checksumBefore) {
            await this.onReplaced?.(undone.replay.startIndex)
        }
        if (unmergedBranch !== undefined) {
            await this.onBranch?.(unmergedBranch, undone.undoneActionIds)
        }
        return {
            game: structuredClone(this.host.game),
            actionReplay,
            canonicalReplay: {
                ...actionReplay,
                userActions: actionReplay.actions.filter(
                    (action) => action.source === ActionSource.User
                )
            },
            checksum: this.host.state.actionChecksum,
            perspective: this.perspective,
            unmergedBranch
        }
    }
}

interface Client {
    playerId: string
    session: SpanSession
    api: Remote
    receive(submission: SpanHostSubmission): Promise<void>
    receiveBranch(unmergedBranch: UnmergedBranch, undoneActionIds?: string[]): Promise<void>
    receiveReplacement(startIndex: number): Promise<void>
    dispose(): void
}

async function table(options: SpanGameOptions = {}) {
    const host = new SpanHost(options)
    host.game.storage = GameStorage.Remote
    const runtime = spanUiRuntime(host.runtime)
    const clients: Client[] = []

    async function join(
        playerId: string,
        { includeActions = true, siteSendsBranch = true } = {}
    ): Promise<Client> {
        const api = new Remote(host, playerId)
        const authorization = new Authorization(api.perspective)
        const gameService = new HarnessGameService(
            new HarnessLibraryService({
                info: { ...spanGameInfo, thumbnailUrl: '' },
                runtime: async () => runtime
            }),
            authorization
        )
        const chatService = new HarnessChatService()
        const notifications = new Notifications()
        const bridge = new BridgedContext({
            authorizationService: authorization,
            gameService,
            chatService,
            gameId: host.game.id
        })
        const loaded = await api.getGame(host.game.id, { includeActions })
        const session = new SpanSession({
            gameService,
            chatService,
            notificationService: notifications,
            api,
            bridgedContext: bridge,
            runtime,
            game: loaded.game,
            state: loaded.game.state,
            actions: loaded.actions,
            historyComplete: loaded.historyComplete,
            unmergedBranch: siteSendsBranch ? loaded.unmergedBranch : undefined
        })
        session.listenToGame()
        await settle(session)
        const emit = (id: string, action: GameNotificationAction, data: object) =>
            notifications.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.User,
                notification: {
                    id,
                    type: NotificationCategory.Game,
                    action,
                    data: {
                        game: structuredClone(host.game),
                        ...data,
                        perspective: api.perspective
                    }
                }
            })
        const client: Client = {
            playerId,
            session,
            api,
            async receive(submission: SpanHostSubmission) {
                const actions = api.projectMainLine(submission)
                if (actions.length === 0) return
                await emit(
                    `delivery-${actions[0].id}`,
                    GameNotificationAction.AddProjectedActions,
                    { actions }
                )
                await settle(session)
            },
            async receiveBranch(unmergedBranch: UnmergedBranch, undoneActionIds?: string[]) {
                await emit(
                    `branch-${unmergedBranch.branch.actionChecksum}`,
                    GameNotificationAction.UpdateBranch,
                    {
                        unmergedBranch: structuredClone(unmergedBranch),
                        ...(undoneActionIds === undefined ? {} : { undoneActionIds })
                    }
                )
            },
            async receiveReplacement(startIndex: number) {
                await emit(
                    `replacement-${host.state.actionChecksum}`,
                    GameNotificationAction.ReplaceProjectedActions,
                    {
                        actionReplay: api.replayFrom(startIndex),
                        checksum: host.state.actionChecksum
                    }
                )
                await settle(session)
            },
            dispose() {
                session.dispose()
                bridge.dispose()
            }
        }
        api.onReplaced = async (startIndex) => {
            for (const other of clients) {
                if (other !== client) await other.receiveReplacement(startIndex)
            }
        }
        api.onMainLine = async (submission) => {
            for (const other of clients) {
                if (other !== client) await other.receive(submission)
            }
        }
        api.onBranch = async (unmergedBranch, undoneActionIds) => {
            for (const sameUser of clients) {
                if (sameUser.playerId === playerId) {
                    await sameUser.receiveBranch(unmergedBranch, undoneActionIds)
                }
            }
        }
        clients.push(client)
        return client
    }

    return {
        host,
        join,
        async settleAll() {
            for (const client of clients) await settle(client.session)
        },
        dispose() {
            for (const client of clients) client.dispose()
        }
    }
}

function played(session: SpanSession): string {
    return summary(session.actions).join()
}

function userActions(session: SpanSession): string {
    return summary(session.actions.filter((action) => action.source === ActionSource.User)).join()
}

export async function runHostedSpanPlay() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        const beginnerPlaysOwnBranch =
            played(p1.session) === 'openBranch:p1' &&
            p1.session.isMyTurn &&
            p1.session.gameState.activePlayerIds.join() === 'p1'
        const otherFetchedOwnBranch =
            played(p2.session) === 'openBranch:p2' && p2.session.isMyTurn && p2.api.syncChecks === 1

        const acceptance = Promise.withResolvers<void>()
        p2.api.pendingAcceptance = acceptance.promise
        const executeAction = GameEngine.prototype.executeAction
        const perspectives: (Visibility.Perspective | undefined)[] = []
        GameEngine.prototype.executeAction = function (input) {
            perspectives.push(input.perspective)
            return executeAction.call(this, input)
        }
        let working: Promise<void>
        try {
            working = p2.session.act('work', 'w2')
            await settle(p2.session)
        } finally {
            GameEngine.prototype.executeAction = executeAction
        }
        const playsBeforeTheHostAnswers =
            played(p2.session) === 'openBranch:p2,work:p2' &&
            t.host.unmergedBranch('p2')?.branch.actionCount === 1
        const playsFromOwnPerspective =
            perspectives.length === 1 &&
            perspectives[0]?.kind === 'player' &&
            perspectives[0].playerId === 'p2'
        acceptance.resolve()
        await working
        p2.api.pendingAcceptance = undefined
        const playedPrivately =
            played(p2.session) === 'openBranch:p2,work:p2' &&
            t.host.state.actionCount === 1 &&
            t.host.unmergedBranch('p2')?.branch.actionCount === 2 &&
            played(p1.session) === 'openBranch:p1'

        const offersUndo = p2.session.undoableAction?.id === 'w2'
        await p2.session.undo()
        await settle(p2.session)
        const undidInBranch =
            played(p2.session) === 'openBranch:p2' &&
            t.host.unmergedBranch('p2')?.branch.actionCount === 1

        await p2.session.act('work', 'w2-again')
        const preview = GameUndo.prototype.preview
        GameUndo.prototype.preview = () => {
            throw Error('Local Undo is unavailable')
        }
        try {
            await p2.session.undo()
        } finally {
            GameUndo.prototype.preview = preview
        }
        await settle(p2.session)
        const undoesFromTheHostsAnswer =
            played(p2.session) === 'openBranch:p2' &&
            t.host.unmergedBranch('p2')?.branch.actionCount === 1

        await p2.session.act('roll', 'r2')
        const rolledOnTheHost =
            userActions(p2.session) === 'roll:p2' &&
            p2.session.gameState.dehydrate().actionCount ===
                t.host.unmergedBranch('p2')?.branch.actionCount
        const stopsUndoAtTheRoll = p2.session.undoableAction === undefined

        return {
            beginnerPlaysOwnBranch,
            otherFetchedOwnBranch,
            playsBeforeTheHostAnswers,
            playsFromOwnPerspective,
            playedPrivately,
            offersUndo,
            undidInBranch,
            undoesFromTheHostsAnswer,
            rolledOnTheHost,
            stopsUndoAtTheRoll
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanMerges() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        const p3 = await t.join('p3')
        const watcher = await t.join('someone-watching')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        await p2.session.act('work', 'w2')
        p2.session.shown.length = 0
        watcher.session.shown.length = 0

        await p3.session.act('work', 'w3')
        await p3.session.act('finish', 'f3')
        await t.settleAll()
        const mergedPlayerSeesMainLine =
            played(p3.session) === 'begin:p1,closeBranch:p3,openBranch:p3,work:p3,finish:p3' &&
            !p3.session.isMyTurn &&
            p3.session.undoableAction === undefined
        const openPlayerKeepsOwnBranch =
            played(p2.session) === 'openBranch:p2,work:p2' &&
            p2.session.isMyTurn &&
            p2.session.gameState.parallelSpan?.mergedPlayerIds.join() === 'p3' &&
            p2.session.gameState.dehydrate().actionCount === 2
        const openPlayerWatchedTheMerge =
            p2.session.shown.join() === 'closeBranch:p3,openBranch:p3,work:p3,finish:p3'
        const spectatorSeesOnlyTheMainLine =
            played(watcher.session) === 'begin:p1,closeBranch:p3,openBranch:p3,work:p3,finish:p3' &&
            watcher.session.shown.join() === 'closeBranch:p3,openBranch:p3,work:p3,finish:p3' &&
            watcher.api.syncChecks === 0

        p2.session.shown.length = 0
        await p2.session.act('finish', 'f2')
        await t.settleAll()
        const ownMergeIsNotReplayed =
            p2.session.shown.filter((shown) => shown.endsWith(':p2')).join() ===
                'finish:p2,closeBranch:p2' &&
            played(p2.session).endsWith('closeBranch:p2,openBranch:p2,work:p2,finish:p2') &&
            !p2.session.isMyTurn

        await p1.session.act('finish', 'f1')
        await t.settleAll()
        const expected = summary(t.host.actions).join()
        const everyoneEndsOnTheMainLine = [p1, p2, p3].every(
            ({ session }) =>
                played(session) === expected && session.gameState.machineState === 'scoring'
        )
        return {
            mergedPlayerSeesMainLine,
            openPlayerKeepsOwnBranch,
            openPlayerWatchedTheMerge,
            spectatorSeesOnlyTheMainLine,
            ownMergeIsNotReplayed,
            everyoneEndsOnTheMainLine
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanReload() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        await p1.session.act('begin', 'begin')
        t.host.submit(spanAction('w2', 'work', 'p2'))

        const older = await t.join('p2', { siteSendsBranch: false })
        await settle(older.session)
        const fetchesBranchTheSiteDidNotSend =
            played(older.session) === 'openBranch:p2,work:p2' && older.session.isMyTurn
        older.dispose()

        const reopened = await t.join('p2', { includeActions: false })
        const opensInOwnBranch =
            reopened.session.isMyTurn &&
            reopened.session.gameState.dehydrate().actionCount === 2 &&
            reopened.session.validActionTypes.includes('work')
        await new Promise((resolve) => setTimeout(resolve, 20))
        await settle(reopened.session)
        const loadsBranchHistory =
            reopened.session.hasCompleteHistory &&
            played(reopened.session) === 'openBranch:p2,work:p2'

        await reopened.session.history.goToPreviousAction()
        await settle(reopened.session)
        const historyStepsBackThroughTheBranch =
            reopened.session.history.inHistory && played(reopened.session) === 'begin:p1'
        await reopened.session.history.goToBeginning()
        await settle(reopened.session)
        const historyReachesTheStartOfTheGame =
            reopened.session.history.inHistory &&
            played(reopened.session) === '' &&
            reopened.session.gameState.machineState === 'setup'

        const merged = t.host.submit(spanAction('f3', 'finish', 'p3'))
        await reopened.receive(merged)
        const staysInHistoryWhenOthersMerge =
            reopened.session.history.inHistory && played(reopened.session) === ''
        await reopened.session.history.goToEnd()
        await settle(reopened.session)
        const returnsToTheBranch =
            !reopened.session.history.inHistory &&
            played(reopened.session) === 'openBranch:p2,work:p2' &&
            reopened.session.gameState.parallelSpan?.mergedPlayerIds.join() === 'p3'
        await reopened.session.history.goToPreviousAction()
        await settle(reopened.session)
        const historyFollowsTheMainLine =
            played(reopened.session) === 'begin:p1,closeBranch:p3,openBranch:p3,finish:p3'
        await reopened.session.history.goToEnd()
        await settle(reopened.session)

        t.host.submit(spanAction('w2b', 'work', 'p2'))
        await reopened.session.retrySynchronization()
        await settle(reopened.session)
        const syncBringsPlayFromElsewhere =
            played(reopened.session) === 'openBranch:p2,work:p2,work:p2'
        await reopened.session.history.goToPreviousAction()
        await settle(reopened.session)
        const historyStepsWithinTheBranch =
            played(reopened.session) ===
                'begin:p1,closeBranch:p3,openBranch:p3,finish:p3,openBranch:p2,work:p2' &&
            reopened.session.currentActionIndex === 5 &&
            reopened.session.gameState.dehydrate().actionCount === 6
        await reopened.session.history.goToEnd()
        await settle(reopened.session)
        await reopened.session.act('work', 'w2c')
        const playsOnAfterHistory =
            played(reopened.session) === 'openBranch:p2,work:p2,work:p2,work:p2' &&
            t.host.unmergedBranch('p2')?.branch.actionCount === 4

        return {
            fetchesBranchTheSiteDidNotSend,
            opensInOwnBranch,
            loadsBranchHistory,
            historyStepsBackThroughTheBranch,
            historyReachesTheStartOfTheGame,
            staysInHistoryWhenOthersMerge,
            returnsToTheBranch,
            historyFollowsTheMainLine,
            syncBringsPlayFromElsewhere,
            historyStepsWithinTheBranch,
            playsOnAfterHistory
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanBarrier() {
    const t = await table({ merge: 'barrier' })
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        const p3 = await t.join('p3')
        await p1.session.act('begin', 'begin')
        await t.settleAll()

        const syncsBeforeClosing = p2.api.syncChecks
        await p2.session.act('work', 'w2')
        await p2.session.act('finish', 'f2')
        await t.settleAll()
        const waitsWithOwnPlayInView =
            played(p2.session) === 'openBranch:p2,work:p2,finish:p2' &&
            !p2.session.isMyTurn &&
            p2.session.gameState.parallelSpan?.closedPlayerIds.join() === 'p2' &&
            p2.api.syncChecks === syncsBeforeClosing &&
            p2.session.gameState.activePlayerIds.join() === 'p3,p1' &&
            t.host.state.actionCount === 2
        const othersSeeOnlyThatItClosed =
            played(p3.session) === 'openBranch:p3' &&
            p3.session.shown.filter((shown) => shown.endsWith(':p2')).join() === 'closeBranch:p2' &&
            p3.session.gameState.parallelSpan?.closedPlayerIds.join() === 'p2' &&
            p3.session.isMyTurn &&
            t.host.game.activePlayerIds?.join() === 'p3,p1'

        await p3.session.act('finish', 'f3')
        p2.session.shown.length = 0
        await p1.session.act('work', 'w1')
        await p1.session.act('finish', 'f1')
        await t.settleAll()
        const watchedEveryoneElse =
            p2.session.shown.join() ===
            'closeBranch:p1,openBranch:p3,finish:p3,openBranch:p1,work:p1,finish:p1,complete:'
        const expected = summary(t.host.actions).join()
        const everyoneEndsOnTheMainLine = [p1, p2, p3].every(
            ({ session }) =>
                played(session) === expected && session.gameState.machineState === 'scoring'
        )
        return {
            waitsWithOwnPlayInView,
            othersSeeOnlyThatItClosed,
            watchedEveryoneElse,
            everyoneEndsOnTheMainLine
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanNextSpan() {
    const t = await table({ spans: 2 })
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        t.host.submit(spanAction('f3', 'finish', 'p3'))
        await p2.session.retrySynchronization()
        await p1.session.retrySynchronization()
        await t.settleAll()
        await p2.session.act('finish', 'f2')
        await t.settleAll()
        await p1.session.act('finish', 'f1')
        await t.settleAll()

        const firstSpan = t.host.state.parallelSpan
        const lastCloserStartsTheNextBranch =
            played(p1.session) === 'openBranch:p1' && p1.session.isMyTurn && p1.api.syncChecks === 1
        const otherFetchesTheNextBranch =
            played(p2.session) === 'openBranch:p2' &&
            p2.session.isMyTurn &&
            p2.session.gameState.parallelSpan?.branchPoint.actionCount ===
                firstSpan?.branchPoint.actionCount
        await p2.session.act('work', 'w2-next')
        return {
            lastCloserStartsTheNextBranch,
            otherFetchesTheNextBranch,
            playsOnInTheNextSpan: t.host.unmergedBranch('p2')?.branch.actionCount === 2
        }
    } finally {
        t.dispose()
    }
}

export async function runJoinedHistoryGrowth() {
    const host = new SpanHost()
    host.submit(spanAction('begin', 'begin', 'p1'))
    host.submit(spanAction('w2', 'work', 'p2'))
    const api = new Remote(host, 'p2')
    const runtime = spanUiRuntime(host.runtime)
    const loaded = await api.getGame(host.game.id)
    assertExists(loaded.unmergedBranch, 'p2 has a Branch')
    const mainLine = new GameContext({
        runtime,
        game: loaded.game,
        state: loaded.game.state,
        actions: loaded.actions
    })
    const branch = createBranchContext(mainLine, loaded.unmergedBranch)
    const joined = new JoinedBranchHistory(mainLine, branch, 'p2')
    const joinsBranchToMainLine =
        summary(joined.context.actions).join() === 'begin:p1,openBranch:p2,work:p2' &&
        joined.context.state.actionCount === 3

    let rebuilds = 0
    const restoreFrom = joined.context.restoreFrom.bind(joined.context)
    joined.context.restoreFrom = (context) => {
        rebuilds += 1
        restoreFrom(context)
    }
    const added = api.project(host.submit(spanAction('w2b', 'work', 'p2')).unmergedBranch)
    assertExists(added, 'p2 played in their Branch')
    for (const action of added.actions) {
        branch.applyActionResults(
            new GameActionResults(
                [action],
                branch.engine.applyProcessedAction({
                    action,
                    state: branch.state,
                    game: branch.game
                })
            )
        )
    }
    joined.refresh()
    joined.context.verifyFullChecksum()
    const appendsWhatTheBranchGained =
        rebuilds === 0 &&
        summary(joined.context.actions).join() === 'begin:p1,openBranch:p2,work:p2,work:p2' &&
        joined.context.state.actionCount === 4

    branch.undoLastAction()
    joined.refresh()
    const rebuildsWhenTheBranchShrinks =
        rebuilds === 1 &&
        summary(joined.context.actions).join() === 'begin:p1,openBranch:p2,work:p2'
    return { joinsBranchToMainLine, appendsWhatTheBranchGained, rebuildsWhenTheBranchShrinks }
}

export async function runHostedSpanFollowsNextSpan() {
    const t = await table({ merge: 'barrier', spans: 2 })
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        const p3 = await t.join('p3')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        await p2.session.act('finish', 'f2')
        await p3.session.act('finish', 'f3')
        p2.session.animationMilliseconds = 5
        await p1.session.act('finish', 'f1')
        await t.settleAll()
        await new Promise((resolve) => setTimeout(resolve, 150))
        await t.settleAll()

        const everyoneHoldsTheNextBranch = [p1, p2, p3].every(
            ({ session, playerId }) =>
                played(session) === `openBranch:${playerId}` &&
                session.isMyTurn &&
                session.validActionTypes.includes('work')
        )
        const waitersWatchedTheFirstSpanEnd = p2.session.shown
            .join()
            .endsWith('openBranch:p3,finish:p3,openBranch:p1,finish:p1,complete:,nextSpan:,state')
        await p2.session.act('work', 'w2-next')
        return {
            everyoneHoldsTheNextBranch,
            waitersWatchedTheFirstSpanEnd,
            playsOnInTheNextSpan: t.host.unmergedBranch('p2')?.branch.actionCount === 2
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanSyncFailure() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        let checks = 0
        const checkSync = p2.api.checkSync.bind(p2.api)
        const getGame = p2.api.getGame.bind(p2.api)
        p2.api.checkSync = async () => {
            checks += 1
            throw Error('offline')
        }
        p2.api.getGame = async () => {
            throw Error('offline')
        }
        await p1.session.act('begin', 'begin')
        await new Promise((resolve) => setTimeout(resolve, 300))
        const asksOnceWhenTheHostCannotBeReached =
            checks === 1 && p2.session.synchronizationFailed && played(p2.session) === 'begin:p1'

        p2.api.checkSync = checkSync
        p2.api.getGame = getGame
        await p2.session.retrySynchronization()
        await settle(p2.session)
        return {
            asksOnceWhenTheHostCannotBeReached,
            recoversWhenAskedAgain: played(p2.session) === 'openBranch:p2' && p2.session.isMyTurn
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanFork() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        await p2.session.act('work', 'w2')
        const forkedAt: number[] = []
        p2.session.gameService.forkGame = async (game, actionIndex) => {
            forkedAt.push(actionIndex)
            return { ...structuredClone(t.host.game), ...structuredClone(game) }
        }
        await p2.session.forkGame('from the present')
        await p2.session.history.goToBeginning()
        await settle(p2.session)
        await p2.session.forkGame('from the start')
        await p2.session.history.goToEnd()
        await settle(p2.session)
        return { forksOnTheMainLine: forkedAt.join() === '0,-1' }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanSecondSession() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const here = await t.join('p2')
        const there = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        const syncsBefore = there.api.syncChecks
        there.session.shown.length = 0

        await here.session.act('work', 'w2')
        await t.settleAll()
        const otherSessionSeesTheAction =
            played(there.session) === 'openBranch:p2,work:p2' &&
            there.session.shown.join() === 'work:p2'
        const submitterAppliesItOnce = played(here.session) === 'openBranch:p2,work:p2'

        await here.session.undo()
        await t.settleAll()
        const otherSessionSeesTheUndo = played(there.session) === 'openBranch:p2'

        await here.session.act('roll', 'r2')
        await t.settleAll()
        const otherSessionSeesTheRoll =
            userActions(there.session) === 'roll:p2' &&
            JSON.stringify(there.session.gameState.dehydrate()) ===
                JSON.stringify(here.session.gameState.dehydrate())

        await there.session.act('work', 'w2-there')
        await t.settleAll()
        const eitherSessionCanPlayOn =
            userActions(here.session) === 'roll:p2,work:p2' &&
            t.host.unmergedBranch('p2')?.branch.actionCount === here.session.actions.length

        await here.session.act('finish', 'f2')
        await t.settleAll()
        const otherSessionSeesTheClose =
            userActions(there.session) === 'roll:p2,work:p2,finish:p2' && !there.session.isMyTurn

        const withoutAnySyncCheck = there.api.syncChecks === syncsBefore

        const late = await t.join('p3')
        const later = await t.join('p3')
        const receiveBranch = later.receiveBranch
        later.receiveBranch = async () => {}
        await late.session.act('work', 'w3a')
        later.receiveBranch = receiveBranch
        const syncsBeforeCatchingUp = later.api.syncChecks
        await late.session.act('work', 'w3b')
        await t.settleAll()
        await new Promise((resolve) => setTimeout(resolve, 50))
        await t.settleAll()
        const catchesUpBySyncAfterMissingOne =
            played(later.session) === 'openBranch:p3,work:p3,work:p3' &&
            later.api.syncChecks === syncsBeforeCatchingUp + 1

        return {
            otherSessionSeesTheAction,
            submitterAppliesItOnce,
            otherSessionSeesTheUndo,
            otherSessionSeesTheRoll,
            eitherSessionCanPlayOn,
            otherSessionSeesTheClose,
            withoutAnySyncCheck,
            catchesUpBySyncAfterMissingOne
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanReopen() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        const p3 = await t.join('p3')
        await p1.session.act('begin', 'begin')
        await t.settleAll()

        await p1.session.act('work', 'w1')
        await p1.session.act('finish', 'f1')
        await t.settleAll()
        const offersUndoOfTheClose =
            !p1.session.isMyTurn &&
            p1.session.undoableAction?.id === 'f1' &&
            p2.session.gameState.parallelSpan?.closedPlayerIds.join() === 'p1'

        await p1.session.undo()
        await t.settleAll()
        const reopensOwnBranch =
            played(p1.session) === 'openBranch:p1,work:p1' &&
            p1.session.isMyTurn &&
            summary(t.host.actions).join() === 'begin:p1' &&
            t.host.unmergedBranch('p1')?.branch.closed === false
        const othersSeeThemPlayingAgain =
            p2.session.gameState.parallelSpan?.closedPlayerIds.join() === '' &&
            played(p2.session) === 'openBranch:p2' &&
            p2.session.isMyTurn

        await p1.session.act('finish', 'f1-again')
        await p3.session.act('work', 'w3')
        await p3.session.act('finish', 'f3')
        await t.settleAll()
        const mainLineBefore = summary(t.host.actions).join()
        await p1.session.undo()
        await t.settleAll()
        const keepsWhatFollowedTheClose =
            mainLineBefore ===
                'begin:p1,closeBranch:p1,closeBranch:p3,openBranch:p3,work:p3,finish:p3' &&
            summary(t.host.actions).join() ===
                'begin:p1,closeBranch:p3,openBranch:p3,work:p3,finish:p3' &&
            played(p1.session) === 'openBranch:p1,work:p1' &&
            p1.session.isMyTurn &&
            p1.session.gameState.parallelSpan?.mergedPlayerIds.join() === 'p3'
        const everyoneAgreesWithTheHost =
            played(p3.session) === summary(t.host.actions).join() &&
            p2.session.gameState.parallelSpan?.closedPlayerIds.join() === 'p3' &&
            p2.session.gameState.parallelSpan?.mergedPlayerIds.join() === 'p3'

        await p1.session.act('finish', 'f1-third')
        await p2.session.act('finish', 'f2')
        await t.settleAll()
        const expected = summary(t.host.actions).join()
        return {
            offersUndoOfTheClose,
            reopensOwnBranch,
            othersSeeThemPlayingAgain,
            keepsWhatFollowedTheClose,
            everyoneAgreesWithTheHost,
            completesAfterwards: [p1, p2, p3].every(
                ({ session }) =>
                    played(session) === expected && session.gameState.machineState === 'scoring'
            )
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanClosesCross() {
    const t = await table({ merge: 'barrier' })
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        const p3 = await t.join('p3')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        const syncsBefore = p2.api.syncChecks

        const acceptance = Promise.withResolvers<void>()
        p2.api.pendingAcceptance = acceptance.promise
        const closing = p2.session.act('finish', 'f2')
        await settle(p2.session)
        await p3.session.act('finish', 'f3')
        acceptance.resolve()
        await closing
        await t.settleAll()
        await new Promise((resolve) => setTimeout(resolve, 50))
        await t.settleAll()

        return {
            hostRecordedTheOtherCloseFirst:
                summary(t.host.actions).join() === 'begin:p1,closeBranch:p3,closeBranch:p2',
            takesBothClosesInOrder:
                p2.session.gameState.parallelSpan?.closedPlayerIds.join() === 'p3,p2' &&
                played(p2.session) === 'openBranch:p2,finish:p2' &&
                !p2.session.isMyTurn,
            withoutFallingBackToASync:
                p2.api.syncChecks === syncsBefore && !p2.session.synchronizationFailed
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanBeginsWhileAnimating() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        p1.session.animationMillisecondsFor['begin:p1'] = 120
        p1.session.shown.length = 0
        await p1.session.act('begin', 'begin')
        await new Promise((resolve) => setTimeout(resolve, 250))
        await settle(p1.session)
        return {
            playsTheBeginningThenTheBranchStart:
                p1.session.shown.join() === 'begin:p1,openBranch:p1',
            endsShowingOwnBranch:
                p1.session.gameState.parallelSpan?.branchPlayerId === 'p1' &&
                p1.session.gameState.activePlayerIds.join() === 'p1' &&
                p1.session.isMyTurn
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanLateBranchUpdates() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()

        const receiveBranch = p2.receiveBranch
        let late: (() => Promise<void>)[] = []
        const holdBack = () => {
            late = []
            p2.receiveBranch = async (...update) => {
                late.push(() => receiveBranch(...update))
            }
        }
        const deliver = async (update: () => Promise<void>) => {
            await update()
            await settle(p2.session)
            await new Promise((resolve) => setTimeout(resolve, 30))
            await settle(p2.session)
        }

        holdBack()
        await p2.session.act('work', 'w2a')
        await p2.session.act('work', 'w2b')
        const syncsBefore = p2.api.syncChecks
        p2.session.shown.length = 0
        await deliver(late[0])
        const keepsTheLaterAction =
            played(p2.session) === 'openBranch:p2,work:p2,work:p2' && p2.session.shown.length === 0
        await deliver(late[1])
        const ignoresWhatItAlreadyHolds =
            played(p2.session) === 'openBranch:p2,work:p2,work:p2' && p2.session.shown.length === 0

        holdBack()
        await p2.session.act('work', 'w2c')
        await p2.session.undo()
        await settle(p2.session)
        const undone = played(p2.session) === 'openBranch:p2,work:p2,work:p2'
        p2.session.shown.length = 0
        await deliver(late[0])
        const ignoresAnActionItHasUndone =
            undone &&
            played(p2.session) === 'openBranch:p2,work:p2,work:p2' &&
            p2.session.shown.length === 0
        await p2.session.act('work', 'w2d')
        p2.session.shown.length = 0
        await deliver(late[1])
        const ignoresAnUndoItHasMade =
            played(p2.session) === 'openBranch:p2,work:p2,work:p2,work:p2' &&
            p2.session.shown.length === 0

        return {
            keepsTheLaterAction,
            ignoresWhatItAlreadyHolds,
            ignoresAnActionItHasUndone,
            ignoresAnUndoItHasMade,
            withoutAnySyncCheck: p2.api.syncChecks === syncsBefore,
            staysInStepWithTheHost:
                t.host.unmergedBranch('p2')?.branch.actionChecksum ===
                p2.session.gameState.dehydrate().actionChecksum
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanUndoBehindTheMainLine() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        await p2.session.act('work', 'w2')

        const merged = t.host.submit(spanAction('f3', 'finish', 'p3'))
        const syncsBefore = p2.api.syncChecks
        await p2.session.undo()
        await settle(p2.session)
        const undoesWithoutTheMainLine =
            played(p2.session) === 'openBranch:p2' &&
            t.host.unmergedBranch('p2')?.branch.actionCount === 1 &&
            p2.api.syncChecks === syncsBefore
        await p2.receive(merged)
        return {
            undoesWithoutTheMainLine,
            thenFollowsTheMainLine:
                played(p2.session) === 'openBranch:p2' &&
                p2.session.gameState.parallelSpan?.mergedPlayerIds.join() === 'p3' &&
                p2.api.syncChecks === syncsBefore &&
                p2.session.isMyTurn
        }
    } finally {
        t.dispose()
    }
}

export async function runHostedSpanReopenBehindTheMainLine() {
    const t = await table()
    try {
        const p1 = await t.join('p1')
        const p2 = await t.join('p2')
        await p1.session.act('begin', 'begin')
        await t.settleAll()
        await p1.session.act('finish', 'f1')
        await t.settleAll()

        t.host.submit(spanAction('r3', 'roll', 'p3'))
        t.host.submit(spanAction('f3', 'finish', 'p3'))
        await p1.session.undo()
        await settle(p1.session)
        await p1.session.retrySynchronization()
        await settle(p1.session)

        const others = (state: { players: { playerId: string }[] }) =>
            JSON.stringify(state.players.filter((player) => player.playerId !== 'p1'))
        return {
            reopened:
                played(p1.session) === 'openBranch:p1' &&
                p1.session.isMyTurn &&
                t.host.unmergedBranch('p1')?.branch.closed === false,
            showsTheOtherMergeOnce:
                others(p1.session.gameState.dehydrate()) === others(t.host.state) &&
                p1.session.gameState.parallelSpan?.mergedPlayerIds.join() === 'p3',
            stillAgreesAfterTheirOwnPlay: await (async () => {
                await p1.session.act('work', 'w1')
                await p2.session.retrySynchronization()
                return others(p1.session.gameState.dehydrate()) === others(t.host.state)
            })()
        }
    } finally {
        t.dispose()
    }
}
