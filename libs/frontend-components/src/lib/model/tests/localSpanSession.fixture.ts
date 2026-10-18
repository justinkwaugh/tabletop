import { assert, GameStorage } from '@tabletop/common'
import { createSpanGame, spanGameInfo, summary } from '@tabletop/common/test-fixtures/span-game'
import { createHarnessAppContext } from '../../harness/harnessContext.js'
import { HarnessSessions } from '../../harness/harnessSessions.svelte.js'
import { settle } from './privateHandSession.fixture.js'
import { SpanSession, spanUiRuntime } from './spanSession.js'

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
    const runtime = spanUiRuntime(spanGame.runtime)
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

export async function runLocalSpanCommonAction() {
    const { sessions, open } = await setup()
    try {
        const session = await open()
        await session.act('begin', 'begin')
        await session.act('work', 'w3')
        const canOfferToAnotherPlayer = session.canViewAsNonActivePlayer
        session.setViewingAsNonActivePlayer(true)
        const offeredToTheNonActingPlayer =
            session.myPlayer?.id === 'p1' && session.validActionTypes.join() === 'propose,chant'
        await session.act('propose', 'o1', { partnerId: 'p2', itemId: 'start-p1' })
        const interruptsTheOpenBranch =
            summary(session.actions).join() === 'begin:p1,openBranch:p3,work:p3,propose:p1' &&
            session.spanState.offers.o1?.proposerId === 'p1' &&
            session.gameState.parallelSpan?.branchPlayerId === 'p3' &&
            session.gameState.machineState === 'working'
        session.setViewingAsNonActivePlayer(false)
        const branchContinues =
            session.myPlayer?.id === 'p3' &&
            session.validActionTypes.join() === 'work,roll,finish,propose,chant'
        const offersUndoOfTheCommonAction = session.undoableAction?.id === 'o1'
        await session.undo()
        await settle(session)
        const undone =
            summary(session.actions).at(-1) === 'work:p3' &&
            Object.keys(session.spanState.offers).length === 0 &&
            session.gameState.parallelSpan?.branchPlayerId === 'p3'
        await session.act('propose', 'o3', { partnerId: 'p1', itemId: 'start-p3' })
        const ownBranchPlayerActsToo =
            summary(session.actions).at(-1) === 'propose:p3' &&
            session.gameState.parallelSpan?.branchPlayerId === 'p3'
        session.setViewingAsNonActivePlayer(true)
        const partnerIsOfferedTheAcceptance =
            session.myPlayer?.id === 'p1' && session.validActionTypes.includes('accept')
        await session.act('accept', 'a1', { offerId: 'o3', itemId: 'start-p1' })
        session.setViewingAsNonActivePlayer(false)
        await session.act('finish', 'f3')
        await session.act('finish', 'f2')
        await session.act('finish', 'f1')
        return {
            canOfferToAnotherPlayer,
            offeredToTheNonActingPlayer,
            interruptsTheOpenBranch,
            branchContinues,
            offersUndoOfTheCommonAction,
            undone,
            ownBranchPlayerActsToo,
            partnerIsOfferedTheAcceptance,
            settledAtSpanCompletion:
                session.gameState.machineState === 'scoring' &&
                session.spanState.items['start-p3'].playerId === 'p1' &&
                session.spanState.items['start-p1'].playerId === 'p3'
        }
    } finally {
        sessions.dispose()
    }
}

export async function runLocalSpanCommonActionByAnyWaitingPlayer() {
    const { sessions, open } = await setup()
    try {
        const session = await open()
        await session.act('begin', 'begin')
        await session.act('work', 'w3')
        session.setViewingAsNonActivePlayer(true)
        const firstWaitingPlayerByDefault = session.myPlayer?.id === 'p1'
        session.viewAsNonActivePlayer('p2')
        const anotherWaitingPlayerCanBeChosen =
            session.myPlayer?.id === 'p2' &&
            session.nonActivePlayers.map((player) => player.id).join() === 'p1,p2' &&
            session.validActionTypes.join() === 'propose,chant'
        await session.act('propose', 'o2', { partnerId: 'p3', itemId: 'start-p2' })
        const actsAsThatPlayer =
            summary(session.actions).join() === 'begin:p1,openBranch:p3,work:p3,propose:p2' &&
            session.spanState.offers.o2?.proposerId === 'p2' &&
            session.gameState.parallelSpan?.branchPlayerId === 'p3'

        session.setViewingAsNonActivePlayer(false)
        await session.act('work', 'w3b')
        const laterBranchPlayComesOffFirst = session.undoableAction?.id === 'w3b'
        await session.act('finish', 'f3')
        const nextBranchOpened = session.gameState.parallelSpan?.branchPlayerId === 'p2'
        session.viewAsNonActivePlayer('p3')
        const closedPlayerCanBeChosen =
            session.isViewingAsNonActivePlayer &&
            session.myPlayer?.id === 'p3' &&
            session.nonActivePlayers.map((player) => player.id).join() === 'p1,p3' &&
            session.validActionTypes.join() === 'propose,chant'
        await session.act('chant', 'c3')
        const closedPlayerActs =
            summary(session.actions).at(-1) === 'chant:p3' &&
            session.gameState.parallelSpan?.branchPlayerId === 'p2'
        session.setViewingAsNonActivePlayer(false)
        const branchPlayerResumes = session.myPlayer?.id === 'p2' && session.isMyTurn
        return {
            firstWaitingPlayerByDefault,
            anotherWaitingPlayerCanBeChosen,
            actsAsThatPlayer,
            laterBranchPlayComesOffFirst,
            nextBranchOpened,
            closedPlayerCanBeChosen,
            closedPlayerActs,
            branchPlayerResumes
        }
    } finally {
        sessions.dispose()
    }
}

export async function runProtectedLocalSpanCommonAction() {
    const { sessions, open } = await setup()
    try {
        const beginner = await open('p1')
        await beginner.act('begin', 'begin')
        const first = await open('p3')
        await first.act('work', 'w3')
        const second = await open('p2')
        const offeredWhileAnotherPlays =
            !second.isMyTurn && second.validActionTypes.join() === 'propose,chant'
        await second.act('propose', 'o2', { partnerId: 'p3', itemId: 'start-p2' })
        const recorded =
            summary(second.actions).join() === 'begin:p1,openBranch:p3,work:p3,propose:p2' &&
            second.spanState.offers.o2?.proposerId === 'p2' &&
            second.gameState.parallelSpan?.branchPlayerId === 'p3'
        const again = await open('p3')
        const otherSessionSeesIt = again.spanState.offers.o2?.proposerId === 'p2' && again.isMyTurn
        await again.act('accept', 'a3', { offerId: 'o2', itemId: 'start-p3' })
        return {
            offeredWhileAnotherPlays,
            recorded,
            otherSessionSeesIt,
            acceptedFromTheOpenBranch:
                summary(again.actions).at(-1) === 'accept:p3' &&
                again.spanState.offers.o2?.agreed === true &&
                again.gameState.parallelSpan?.branchPlayerId === 'p3'
        }
    } finally {
        sessions.dispose()
    }
}
