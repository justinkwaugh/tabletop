import { tick } from 'svelte'
import * as Value from 'typebox/value'
import {
    ActionSource,
    GameStorage,
    GameSyncStatus,
    GameNotificationAction,
    NotificationCategory,
    Role,
    UserStatus,
    Visibility,
    assert,
    assertExists,
    type GameAction,
    type Game
} from '@tabletop/common'
import {
    PrivateHandHost,
    runtime,
    refillRuntime,
    info,
    PlaySchema,
    DrawSchema,
    p1,
    p2,
    spectator,
    CanonicalValidator,
    SharedValidator,
    HydratedPrivateHandState,
    type SharedState
} from '@tabletop/common/test-fixtures/private-hand'
import { GameSession } from '../gameSession.svelte.js'
import { BridgedContext } from '../../services/bridges/bridgedContext.svelte.js'
import { HarnessAuthorizationService } from '../../harness/harnessAuthorizationService.svelte.js'
import { HarnessLibraryService } from '../../harness/harnessLibraryService.js'
import { HarnessGameService } from '../../harness/harnessGameService.svelte.js'
import { HarnessChatService } from '../../harness/harnessChatService.svelte.js'
import { DummyNotificationService } from '../../harness/dummyNotificationService.js'
import { DummyRemoteApiService } from '../../harness/dummyRemoteApiService.js'
import { DefaultColorizer } from '../../definition/gameColorizer.js'
import type { GameUIRuntime } from '../../definition/gameUiDefinition.js'
import { NotificationChannel, NotificationEventType } from '../../services/notificationService.js'

export class PrivateHandSession extends GameSession<SharedState, HydratedPrivateHandState> {
    play(cardId: string) {
        return this.applyAction(this.createPlayerAction(PlaySchema, { cardId }))
    }
    draw() {
        return this.applyAction(this.createPlayerAction(DrawSchema, { revealsInfo: true }))
    }
}

const uiRuntime = {
    ...runtime,
    sessionClass: PrivateHandSession,
    colorizer: new DefaultColorizer(),
    gameUI: {
        load: async () => {
            throw Error('Session test does not render a table')
        },
        mount: () => {
            throw Error('Session test does not render a table')
        }
    }
} satisfies GameUIRuntime<SharedState, HydratedPrivateHandState>

class Authorization extends HarnessAuthorizationService {
    constructor(private readonly perspective: Visibility.Perspective) {
        super()
    }
    getSessionUser() {
        return {
            id: this.perspective.kind === 'player' ? this.perspective.playerId : 'spectator',
            roles: [Role.User],
            status: UserStatus.Active,
            externalIds: []
        }
    }
}

class Remote extends DummyRemoteApiService {
    submissions = 0
    undos = 0
    pendingAcceptance?: Promise<void>
    onSubmit?: () => void

    constructor(
        private readonly host: PrivateHandHost,
        private readonly perspective: Visibility.Perspective
    ) {
        super()
    }
    async getGame(_id: string, options?: { hostView?: boolean }) {
        const history = this.host.history(options?.hostView ? undefined : this.perspective)
        return {
            game: { ...structuredClone(this.host.game), state: history.currentState },
            actions: [...history.actions]
        }
    }
    async checkSync() {
        return {
            status: GameSyncStatus.InSync,
            checksum: this.host.state.actionChecksum,
            actions: []
        }
    }
    async applyAction(_game: Game, action: GameAction) {
        this.submissions += 1
        this.onSubmit?.()
        await this.pendingAcceptance
        assert(
            this.perspective.kind === 'player' && action.playerId === this.perspective.playerId,
            'Wrong acting player'
        )
        const result = this.host.apply(action)
        assertExists(runtime.visibility, 'Expected private-hand visibility')
        const projected = Visibility.projectActionCascade(result.actionCascade, {
            visibility: runtime.visibility,
            perspective: this.perspective,
            replay: { game: this.host.game, runtime: this.host.engine.runtime }
        })
        return {
            game: structuredClone(this.host.game),
            actions: [...projected.actions],
            perspective: this.perspective
        }
    }
    async undoAction(_game: Game, actionId: string) {
        this.undos += 1
        this.host.undo(actionId)
        const history = this.host.history(this.perspective)
        const actionReplay = { startIndex: 0, actions: [...history.actions] }
        return {
            game: structuredClone(this.host.game),
            actionReplay,
            canonicalReplay: {
                ...actionReplay,
                userActions: history.actions.filter((a) => a.source === ActionSource.User)
            },
            checksum: this.host.state.actionChecksum,
            perspective: this.perspective
        }
    }
}

function client(host: PrivateHandHost, perspective: Visibility.Perspective = p1) {
    host.game.storage = GameStorage.Remote
    const authorization = new Authorization(perspective)
    const library = new HarnessLibraryService({
        info: { ...info, thumbnailUrl: '' },
        runtime: async () => ({ ...uiRuntime, ...host.engine.runtime, sessionClass: GameSession })
    })
    const gameService = new HarnessGameService(library, authorization)
    const chatService = new HarnessChatService()
    const notifications = new DummyNotificationService()
    const api = new Remote(host, perspective)
    const bridge = new BridgedContext({
        authorizationService: authorization,
        gameService,
        chatService,
        gameId: host.game.id
    })
    const history = host.history(perspective)
    const session = new PrivateHandSession({
        gameService,
        chatService,
        notificationService: notifications,
        api,
        bridgedContext: bridge,
        runtime: { ...uiRuntime, ...host.engine.runtime },
        game: structuredClone(host.game),
        state: history.currentState,
        actions: [...history.actions]
    })
    session.listenToGame()
    return {
        session,
        api,
        authorization,
        async notify(result: ReturnType<PrivateHandHost['apply']>) {
            assertExists(runtime.visibility, 'Expected private-hand visibility')
            const projected = Visibility.projectActionCascade(result.actionCascade, {
                visibility: runtime.visibility,
                perspective,
                replay: { game: host.game, runtime: host.engine.runtime }
            })
            await notifications.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.User,
                notification: {
                    id: 'delivery',
                    type: NotificationCategory.Game,
                    action: GameNotificationAction.AddProjectedActions,
                    data: {
                        game: structuredClone(host.game),
                        actions: [...projected.actions],
                        perspective
                    }
                }
            })
        },
        dispose() {
            session.dispose()
            bridge.dispose()
        }
    }
}

async function settle(session: PrivateHandSession) {
    await tick()
    await session.waitForVisibleTransitionSettled()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await tick()
}

export async function runPrivateHandPlayAndUndo() {
    const host = new PrivateHandHost()
    const c = client(host)
    try {
        await settle(c.session)
        assert(c.session.validActionTypes.includes('play'), 'Owner cannot discover play')
        assert(Value.Equal(c.session.gameState.choices('p1'), ['r1']), 'Owner choices differ')
        assert(c.session.gameState.getPlayerState('p2').hand === undefined, 'Other hand leaked')
        let accept: (() => void) | undefined
        c.api.pendingAcceptance = new Promise<void>((resolve) => {
            accept = resolve
        })
        const received = new Promise<void>((resolve) => {
            c.api.onSubmit = resolve
        })
        const pending = c.session.play('r1')
        await received
        assert(host.state.players[0].hand.cards.length === 2, 'Host accepted too early')
        assert(c.session.actions.length === 1, 'Owner play was not optimistic')
        assertExists(accept, 'Expected acceptance control')
        accept()
        await pending
        await settle(c.session)
        assert(
            Value.Equal(c.session.gameState.dehydrate(), host.history(p1).currentState),
            'Accepted state differs'
        )
        await c.session.history.goToBeginning()
        await settle(c.session)
        assert(
            c.session.gameState.getPlayerState('p1').knownHand().cards.length === 2,
            'History lost owner hand'
        )
        await c.session.history.goToEnd()
        await settle(c.session)
        await c.session.undo()
        await settle(c.session)
        assert(c.api.undos === 1, 'Undo did not reach host')
        assert(
            Value.Equal(c.session.gameState.dehydrate(), host.history(p1).currentState),
            'Undo differs'
        )
        return { optimistic: true, history: true, undo: true }
    } finally {
        c.dispose()
    }
}

export async function runPrivateHandDelivery() {
    const host = new PrivateHandHost()
    const owner = client(host, p1),
        opponent = client(host, p2),
        observer = client(host, spectator)
    try {
        await settle(owner.session)
        const result = host.apply({
            id: 'draw-card',
            gameId: host.game.id,
            source: ActionSource.User,
            playerId: 'p1',
            type: 'draw',
            revealsInfo: true
        })
        await Promise.all([owner.notify(result), opponent.notify(result), observer.notify(result)])
        for (const c of [owner, opponent, observer]) await settle(c.session)
        assert(
            owner.session.gameState.getPlayerState('p1').knownHand().cards.length === 3,
            'Owner did not receive drawn card'
        )
        assert(
            opponent.session.gameState.getPlayerState('p1').hand === undefined,
            'Drawn card leaked to opponent'
        )
        assert(
            observer.session.gameState.players.every((p) => p.hand === undefined),
            'Spectator received a hand'
        )
        assert(observer.session.validActionTypes.length === 0, 'Spectator can act')
        for (const c of [owner, opponent, observer]) {
            assert(c.session.gameState.drawPile.items.length === 0, 'Deck order leaked')
            assert(c.session.gameState.secretBonus === undefined, 'Secret scalar leaked')
            assert(
                c.session.gameState.actionChecksum === host.state.actionChecksum,
                'Delivery checksum differs'
            )
        }
        return { owner: true, opponent: true, spectator: true }
    } finally {
        owner.dispose()
        opponent.dispose()
        observer.dispose()
    }
}

export async function runPrivateHandDrawAndReload() {
    const host = new PrivateHandHost()
    const c = client(host)
    try {
        await settle(c.session)
        await c.session.draw()
        await settle(c.session)
        assert(c.api.submissions === 1, 'Draw did not reach host')
        assert(
            Value.Equal(c.session.gameState.dehydrate(), host.history(p1).currentState),
            'Draw differs'
        )
        assert(c.session.undoableAction === undefined, 'Revealing draw permits Undo')
        const refreshed = client(host)
        try {
            await settle(refreshed.session)
            assert(
                Value.Equal(
                    refreshed.session.gameState.dehydrate(),
                    c.session.gameState.dehydrate()
                ),
                'Reload differs'
            )
        } finally {
            refreshed.dispose()
        }
        return { authoritative: true, reload: true }
    } finally {
        c.dispose()
    }
}

export async function runPrivateHandExploration() {
    const host = new PrivateHandHost()
    const openingPlay = {
        id: 'play-one',
        gameId: host.game.id,
        source: ActionSource.User,
        playerId: 'p1',
        type: 'play',
        cardId: 'r1'
    }
    host.apply(openingPlay)
    const c = client(host, p2)
    try {
        await settle(c.session)
        await c.session.startExploring()
        await settle(c.session)
        const exploration = c.session.explorations.getCurrentExploration()
        assertExists(exploration, 'Expected hypothetical context')
        assert(CanonicalValidator.Check(exploration.state), 'Population is incomplete')
        assert(
            Value.Equal(exploration.state.players[1].hand, host.state.players[1].hand),
            'Known hand changed'
        )
        assert(
            exploration.state.explorationState?.checkpoint?.undoLimit === 1,
            'Patched history permits Undo'
        )
        assert(c.session.undoableAction === undefined, 'Inherited Undo crosses projection')
        await c.session.play('r2')
        await settle(c.session)
        assert(c.api.submissions === 0, 'Exploration changed hosted game')
        assert(
            CanonicalValidator.Check(c.session.gameState.dehydrate()),
            'Exploration action lost complete state'
        )
        assert(host.actions.length === 1, 'Exploration changed host history')
        const sampledState = exploration.state
        const comparableSample = { ...sampledState, explorationState: undefined }
        for (let pass = 0; pass < 3; pass++) {
            await c.session.history.goToBeginning()
            await settle(c.session)
            assert(
                c.session.history.visibleContext.state.players[0].hand === undefined,
                'History exposed a hypothetical hand'
            )
            await c.session.history.goToActionIndex(host.actions.length - 1)
            await settle(c.session)
            assert(
                c.session.history.visibleContext.state.drawPile.items.length === 0,
                'Source History exposed the hypothetical deck'
            )
            await c.session.history.goToActionIndex(sampledState.actionCount - 1)
            await settle(c.session)
            assert(
                Value.Equal(
                    { ...c.session.history.visibleContext.state, explorationState: undefined },
                    comparableSample
                ),
                'History changed the sampled future'
            )
        }
        c.session.history.goToEnd()
        await settle(c.session)
        await c.session.explorations.saveExploration('Private-hand sample')
        const id = exploration.game.id
        c.session.explorations.endExploring()
        await settle(c.session)
        await c.session.startExploring()
        await settle(c.session)
        await c.session.explorations.switchExploration(id)
        await settle(c.session)
        assert(c.session.isExploring, 'Saved Exploration is not active')
        const loaded = c.session.explorations.getCurrentExploration()
        assertExists(loaded, 'Saved Exploration did not load')
        assert(Value.Equal(loaded.state, sampledState), 'Saved Exploration changed its sample')
        await c.session.history.goToBeginning()
        await settle(c.session)
        await c.session.history.goToActionIndex(loaded.state.actionCount - 1)
        await settle(c.session)
        assert(
            Value.Equal(
                { ...c.session.history.visibleContext.state, explorationState: undefined },
                comparableSample
            ),
            'Reloaded History changed the sampled future'
        )
        return {
            complete: true,
            knownHand: true,
            hypotheticalPlay: true,
            savedSample: true,
            historyRoundTrip: true
        }
    } finally {
        c.dispose()
    }
}

export async function runPrivateHandHostView() {
    const host = new PrivateHandHost()
    const c = client(host)
    try {
        await settle(c.session)
        await c.session.setPrivilegedGameViewEnabled(true)
        await settle(c.session)
        assert(c.session.isViewingHost, 'Host View is unavailable')
        assert(CanonicalValidator.Check(c.session.gameState.dehydrate()), 'Host View lost secrets')
        await c.session.startExploring()
        await settle(c.session)
        assert(
            CanonicalValidator.Check(c.session.gameState.dehydrate()),
            'Host Exploration lost secrets'
        )
        assert(
            SharedValidator.Check(c.session.gameState.dehydrate()),
            'Shared validator rejects host state'
        )
        return { hostView: true, hostExploration: true }
    } finally {
        c.dispose()
    }
}

export async function runPrivateHandProtectedFallback() {
    const host = new PrivateHandHost(refillRuntime)
    const c = client(host)
    try {
        await settle(c.session)
        let accept: (() => void) | undefined
        c.api.pendingAcceptance = new Promise<void>((resolve) => {
            accept = resolve
        })
        const received = new Promise<void>((resolve) => {
            c.api.onSubmit = resolve
        })
        const pending = c.session.play('r1')
        await received
        assert(c.session.actions.length === 0, 'Protected refill was committed optimistically')
        assert(host.actions.length === 0, 'Host accepted too early')
        assertExists(accept, 'Expected acceptance control')
        accept()
        await pending
        await settle(c.session)
        assert(
            Value.Equal(c.session.gameState.dehydrate(), host.history(p1).currentState),
            'Authoritative fallback differs'
        )
        assert(
            c.session.gameState.getPlayerState('p1').knownHand().cards.length === 2,
            'Host did not refill the hand'
        )
        assert(c.session.undoableAction === undefined, 'Refill reveal permits Undo')
        return { fallback: true, ownerReceivesCard: true, undoBlocked: true }
    } finally {
        c.dispose()
    }
}
