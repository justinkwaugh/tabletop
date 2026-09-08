import { mount, tick } from 'svelte'
import * as Value from 'typebox/value'
import {
    assert,
    assertExists,
    GameStorage,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    PrivateHandHost,
    info,
    CanonicalValidator,
    HydratedPrivateHandState,
    refillRuntime,
    PlaySchema
} from '@tabletop/common/test-fixtures/private-hand'
import { createHarnessAppContext, type HarnessAppContext } from '../../harness/harnessContext.js'
import { HarnessSessions } from '../../harness/harnessSessions.svelte.js'
import { GameSession } from '../gameSession.svelte.js'
import { uiRuntime, settle } from './privateHandSession.fixture.js'
import Harness from '../../components/Harness.svelte'
import ProtectedHarnessTable from './ProtectedHarnessTable.svelte'
import { mountDynamicComponent } from '../../utils/dynamicComponent.js'

class HarnessPrivateHandSession extends GameSession<GameState, HydratedGameState> {
    play(cardId: string) {
        return this.applyAction(this.createPlayerAction(PlaySchema, { cardId }))
    }
    get privateState() {
        assert(this.gameState instanceof HydratedPrivateHandState, 'Expected private-hand state')
        return this.gameState
    }
}

async function setup(refill = false) {
    const host = new PrivateHandHost(refill ? refillRuntime : undefined)
    host.game.hotseat = true
    host.game.storage = GameStorage.Local
    host.game.id = crypto.randomUUID()
    host.state.gameId = host.game.id
    host.game.name = 'Privacy test'
    host.game.ownerId = 'harness-user'
    for (const player of host.game.players) player.userId = 'harness-user'
    const selectedRuntime = {
        ...uiRuntime,
        ...host.engine.runtime,
        sessionClass: HarnessPrivateHandSession,
        gameUI: {
            component: ProtectedHarnessTable,
            load: async () => ProtectedHarnessTable,
            mount: mountDynamicComponent
        }
    }
    const definition = { info: { ...info, thumbnailUrl: '' }, runtime: async () => selectedRuntime }
    const app = createHarnessAppContext(definition)
    app.authorizationService.debugViewEnabled = false
    app.authorizationService.adminCapabilitiesEnabled = false
    await app.gameService.saveGameLocally({ game: host.game, state: host.state, actions: [] })
    return { host, definition, app, sessions: new HarnessSessions(app, definition) }
}

async function submitWithHeldSave(
    app: HarnessAppContext,
    session: HarnessPrivateHandSession,
    expectedOptimisticCount: number
) {
    const save = app.gameService.saveGameLocally.bind(app.gameService)
    let release: (() => void) | undefined
    const held = new Promise<void>((resolve) => {
        release = resolve
    })
    let received: (() => void) | undefined
    const submitted = new Promise<void>((resolve) => {
        received = resolve
    })
    app.gameService.saveGameLocally = async (input) => {
        received?.()
        await held
        return save(input)
    }
    const pending = session.play('r1')
    try {
        await submitted
        assert(session.actions.length === expectedOptimisticCount, 'Incorrect optimistic execution')
    } finally {
        assertExists(release, 'Save gate missing')
        release()
        await pending
        app.gameService.saveGameLocally = save
    }
}

async function active(sessions: HarnessSessions) {
    assert(sessions.error === undefined, sessions.error ?? '')
    const session = sessions.session
    assert(session instanceof HarnessPrivateHandSession, 'Expected private-hand session')
    await settle(session)
    return session
}

export async function runProtectedHarnessPlay() {
    const { host, app, sessions } = await setup()
    try {
        await sessions.load(host.game.id, true, 'p1')
        let session = await active(sessions)
        assert(
            session.game.storage === GameStorage.Local && session.game.hotseat,
            'Storage or hotseat was disguised'
        )
        assert(session.myPlayer?.id === 'p1' && session.isMyTurn, 'Wrong acting player')
        assert(session.privateState.players[1].hand === undefined, 'Opponent hand leaked')
        app.authorizationService.debugViewEnabled = true
        app.authorizationService.adminCapabilitiesEnabled = true
        await settle(session)
        assert(
            !session.isViewingHost && !session.isActingAdmin,
            'Debug/Admin bypassed protected view'
        )
        await submitWithHeldSave(app, session, 1)
        await settle(session)
        let stored = await app.gameService.loadGame(host.game.id)
        assert(
            CanonicalValidator.Check(stored.game?.state),
            'Saved projection instead of canonical state'
        )
        assert(
            stored.actions.length === 1 && session.actions.length === 1,
            'Play was not saved/reconciled'
        )
        await session.history.goToBeginning()
        await settle(session)
        await sessions.load(host.game.id, true, 'p2')
        session = await active(sessions)
        assert(
            session.history.inHistory && session.currentActionIndex === -1,
            'Perspective switch moved history'
        )
        assert(session.myPlayer?.id === 'p2', 'Hotseat selected the wrong player')
        assert(
            session.privateState.players[0].hand === undefined,
            'Previous player knowledge survived switch'
        )
        assert(session.privateState.players[1].hand !== undefined, 'New owner lost own hand')
        await session.history.goToEnd()
        await settle(session)
        assert(session.undoableAction === undefined, 'Opponent may undo the preceding action')
        await sessions.load(host.game.id, true, 'p1')
        session = await active(sessions)
        assertExists(session.undoableAction, 'Owner cannot undo')
        await session.undo()
        await settle(session)
        stored = await app.gameService.loadGame(host.game.id)
        assert(stored.actions.length === 0 && session.actions.length === 0, 'Host Undo failed')
        assert(CanonicalValidator.Check(stored.game?.state), 'Undo persisted incomplete state')
        await sessions.load(host.game.id, true, 'spectator')
        session = await active(sessions)
        assert(
            session.myPlayer === undefined &&
                !session.isMyTurn &&
                session.validActionTypes.length === 0,
            'Spectator may play'
        )
        assert(
            session.privateState.players.every((player) => player.hand === undefined),
            'Spectator received hands'
        )
        await sessions.load(host.game.id, true, 'host')
        session = await active(sessions)
        assert(
            session.isViewingHost && CanonicalValidator.Check(session.privateState.dehydrate()),
            'Host View missing'
        )
        await session.play('r1')
        await settle(session)
        assert(session.actions.length === 1, 'Host View cannot play')
        await sessions.load(host.game.id, true, 'p2')
        session = await active(sessions)
        assert(
            !session.isViewingHost && session.privateState.players[0].hand === undefined,
            'Host data survived demotion'
        )
        await sessions.load(host.game.id, false)
        session = await active(sessions)
        assert(
            CanonicalValidator.Check(session.privateState.dehydrate()),
            'Ordinary hotseat is projected'
        )
        return {
            play: true,
            undo: true,
            switching: true,
            spectator: true,
            host: true,
            canonicalSave: true
        }
    } finally {
        sessions.dispose()
    }
}

export async function runProtectedHarnessExploration() {
    const { host, app, sessions } = await setup()
    try {
        await sessions.load(host.game.id, true, 'p1')
        const session = await active(sessions)
        await session.play('r1')
        await settle(session)
        await session.history.goToBeginning()
        await settle(session)
        await session.startExploring()
        await settle(session)
        assert(
            session.isExploring && CanonicalValidator.Check(session.privateState.dehydrate()),
            'Population did not complete'
        )
        await session.play('r1')
        await settle(session)
        await session.undo()
        await settle(session)
        const stored = await app.gameService.loadGame(host.game.id)
        assert(stored.actions.length === 1, 'Exploration changed canonical game')
        session.explorations.endExploring()
        await settle(session)
        assert(
            session.history.inHistory && session.currentActionIndex === -1,
            'Exploration failed to restore source'
        )
        assert(
            session.privateState.players[1].hand === undefined,
            'Exploration secrets survived return'
        )
        return { hypothetical: true, localUndo: true, restoredHistory: true }
    } finally {
        sessions.dispose()
    }
}

export async function runProtectedHarnessFallback() {
    const { host, app, sessions } = await setup(true)
    try {
        await sessions.load(host.game.id, true, 'p1')
        const session = await active(sessions)
        await submitWithHeldSave(app, session, 0)
        await settle(session)
        const stored = await app.gameService.loadGame(host.game.id)
        assertExists(stored.game?.state, 'Canonical save missing')
        assert(CanonicalValidator.Check(stored.game.state), 'Saved state is incomplete')
        const state = new HydratedPrivateHandState(stored.game.state)
        assert(state.players[0].knownHand().cards.length === 2, 'Canonical fallback did not refill')
        assert(
            session.privateState.players[0].knownHand().cards.length === 2,
            'Owner did not receive refill'
        )
        assert(session.privateState.players[1].hand === undefined, 'Fallback leaked another hand')
        assert(session.undoableAction === undefined, 'Revealing cascade permits Undo')
        const before = session.privateState.dehydrate()
        await sessions.load(host.game.id, true, 'p1')
        const reloaded = await active(sessions)
        assert(Value.Equal(before, reloaded.privateState.dehydrate()), 'Reload changed projection')
        return { fallback: true, reload: true }
    } finally {
        sessions.dispose()
    }
}

export async function mountProtectedHarness() {
    const { definition } = await setup()
    mount(Harness, { target: document.body, props: { definition } })
    await tick()
}
