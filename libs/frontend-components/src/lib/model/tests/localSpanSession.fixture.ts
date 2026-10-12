import {
    assert,
    assertExists,
    GameStorage,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    createSpanGame,
    spanAction,
    spanGameInfo,
    summary,
    type SpanActionType
} from '@tabletop/common/test-fixtures/span-game'
import { createHarnessAppContext } from '../../harness/harnessContext.js'
import { HarnessSessions } from '../../harness/harnessSessions.svelte.js'
import { GameSession } from '../gameSession.svelte.js'
import { settle, uiRuntime } from './privateHandSession.fixture.js'

class SpanSession extends GameSession<GameState, HydratedGameState> {
    async act(type: SpanActionType, id: string) {
        assertExists(this.myPlayer, 'Nobody is acting')
        await this.applyAction({
            ...spanAction(id, type, this.myPlayer.id),
            gameId: this.game.id
        })
        await settle(this)
    }
}

async function setup() {
    const spanGame = createSpanGame()
    const game = {
        ...spanGame.game,
        id: crypto.randomUUID(),
        name: 'Span test',
        ownerId: 'harness-user',
        hotseat: true,
        storage: GameStorage.Local,
        players: spanGame.game.players.map((player) => ({ ...player, userId: 'harness-user' }))
    }
    const runtime = { ...uiRuntime, ...spanGame.runtime, sessionClass: SpanSession }
    const definition = {
        info: { ...spanGameInfo, thumbnailUrl: '' },
        runtime: async () => runtime
    }
    const app = createHarnessAppContext(definition)
    app.authorizationService.debugViewEnabled = false
    app.authorizationService.adminCapabilitiesEnabled = false
    await app.gameService.saveGameLocally({
        game,
        state: { ...spanGame.state, gameId: game.id },
        actions: []
    })
    const sessions = new HarnessSessions(app, definition)
    return {
        sessions,
        async open(protectedView?: string) {
            await sessions.load(game.id, protectedView !== undefined, protectedView)
            assert(sessions.error === undefined, sessions.error ?? '')
            const session = sessions.session
            assert(session instanceof SpanSession, 'Expected a span session')
            await settle(session)
            return session
        }
    }
}

export async function runLocalSpan() {
    const { sessions, open } = await setup()
    try {
        const session = await open()
        const actingPlayerIds = [session.myPlayer?.id]
        await session.act('begin', 'begin')
        actingPlayerIds.push(session.myPlayer?.id)
        const openedFirstBranch = summary(session.actions).join() === 'begin:p1,openBranch:p3'

        await session.act('work', 'w3')
        await session.act('finish', 'f3')
        actingPlayerIds.push(session.myPlayer?.id)
        const openedNextBranch = summary(session.actions).at(-1) === 'openBranch:p2'

        const offersUndoOfTheClose = session.undoableAction?.id === 'f3'
        await session.undo()
        await settle(session)
        actingPlayerIds.push(session.myPlayer?.id)
        const undoReopenedTheBranch =
            summary(session.actions).at(-1) === 'work:p3' &&
            session.gameState.parallelSpan?.branchPlayerId === 'p3'

        await session.act('finish', 'f3-again')
        await session.act('finish', 'f2')
        actingPlayerIds.push(session.myPlayer?.id)
        await session.act('finish', 'f1')
        const completed =
            session.gameState.machineState === 'scoring' &&
            session.gameState.parallelSpan === undefined &&
            summary(session.actions).at(-1) === 'complete:'

        return {
            followsMergeOrder: actingPlayerIds.join() === 'p1,p3,p2,p3,p1',
            openedFirstBranch,
            openedNextBranch,
            offersUndoOfTheClose,
            undoReopenedTheBranch,
            keepsTheLastCloseOnceTheSpanCompletes: session.undoableAction === undefined,
            completed
        }
    } finally {
        sessions.dispose()
    }
}

export async function runProtectedLocalSpan() {
    const { sessions, open } = await setup()
    try {
        const beginner = await open('p1')
        await beginner.act('begin', 'begin')
        const beginnerSeesFirstBranch =
            summary(beginner.actions).join() === 'begin:p1,openBranch:p3' && !beginner.isMyTurn

        const first = await open('p3')
        await first.act('work', 'w3')
        await first.act('finish', 'f3')
        const firstSeesNextBranch =
            summary(first.actions).at(-1) === 'openBranch:p2' && !first.isMyTurn

        const second = await open('p2')
        await second.act('finish', 'f2')
        const last = await open('p1')
        await last.act('finish', 'f1')
        return {
            beginnerSeesFirstBranch,
            firstSeesNextBranch,
            completed:
                last.gameState.machineState === 'scoring' &&
                summary(last.actions).at(-1) === 'complete:'
        }
    } finally {
        sessions.dispose()
    }
}
