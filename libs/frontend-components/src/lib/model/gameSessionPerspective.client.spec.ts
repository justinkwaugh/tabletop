import { GameStorage, Role, UserStatus, Visibility, type User } from '@tabletop/common'
import {
    PrivateHandHost,
    info,
    p2,
    spectator,
    type HydratedPrivateHandState,
    type SharedState
} from '@tabletop/common/test-fixtures/private-hand'
import { afterEach, describe, expect, test } from 'vitest'
import { DummyNotificationService } from '$lib/harness/dummyNotificationService.js'
import { DummyRemoteApiService } from '$lib/harness/dummyRemoteApiService.js'
import { HarnessAuthorizationService } from '$lib/harness/harnessAuthorizationService.svelte.js'
import { HarnessChatService } from '$lib/harness/harnessChatService.svelte.js'
import { HarnessGameService } from '$lib/harness/harnessGameService.svelte.js'
import { HarnessLibraryService } from '$lib/harness/harnessLibraryService.js'
import type { GetGameOptions } from '$lib/network/tabletopApi.svelte.js'
import { BridgedContext } from '$lib/services/bridges/bridgedContext.svelte.js'
import { GameSession } from './gameSession.svelte.js'
import { settle, uiRuntime } from './tests/privateHandSession.fixture.js'

type PerspectiveSession = GameSession<SharedState, HydratedPrivateHandState>

class SessionUser extends HarnessAuthorizationService {
    constructor(private readonly userId: string) {
        super()
    }

    override getSessionUser(): User {
        return {
            id: this.userId,
            username: this.userId,
            roles: [Role.User, Role.Admin],
            status: UserStatus.Active,
            externalIds: []
        }
    }
}

class HostRemote extends DummyRemoteApiService {
    constructor(
        private readonly host: PrivateHandHost,
        private readonly perspective: Visibility.Perspective
    ) {
        super()
    }

    override async getGame(_gameId: string, options?: GetGameOptions) {
        const history = this.host.history(options?.hostView ? undefined : this.perspective)
        return {
            game: { ...structuredClone(this.host.game), state: history.currentState },
            actions: [...history.actions]
        }
    }
}

const disposers: Array<() => void> = []

afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose()
})

async function openSession({
    hotseat,
    userId,
    activePlayerIds = ['p1'],
    hostPerspective
}: {
    hotseat: boolean
    userId: string
    activePlayerIds?: string[]
    hostPerspective?: Visibility.Perspective
}) {
    const host = new PrivateHandHost()
    host.game.hotseat = hotseat
    host.game.storage = hotseat ? GameStorage.Local : GameStorage.Remote
    host.state.activePlayerIds = activePlayerIds
    host.game.activePlayerIds = [...activePlayerIds]

    const userPerspective: Visibility.Perspective =
        hostPerspective ??
        (host.game.players.some((player) => player.userId === userId)
            ? { kind: 'player', playerId: userId }
            : spectator)
    const loaded = host.history(hotseat && !hostPerspective ? undefined : userPerspective)

    const authorization = new SessionUser(userId)
    const library = new HarnessLibraryService({
        info: { ...info, thumbnailUrl: '' },
        runtime: async () => ({ ...uiRuntime, sessionClass: GameSession })
    })
    const gameService = new HarnessGameService(library, authorization)
    const chatService = new HarnessChatService()
    const bridgedContext = new BridgedContext({
        authorizationService: authorization,
        gameService,
        chatService,
        gameId: host.game.id
    })
    const session = new GameSession<SharedState, HydratedPrivateHandState>({
        gameService,
        bridgedContext,
        notificationService: new DummyNotificationService(),
        chatService,
        api: new HostRemote(host, userPerspective),
        runtime: uiRuntime,
        game: structuredClone(host.game),
        state: loaded.currentState,
        actions: [...loaded.actions],
        hostPerspective
    })
    disposers.push(() => {
        session.dispose()
        bridgedContext.dispose()
    })
    await settle(session)
    return { session, authorization }
}

async function enableAdmin(
    authorization: HarnessAuthorizationService,
    session: PerspectiveSession
) {
    authorization.adminCapabilitiesEnabled = true
    await settle(session)
    await settle(session)
    expect(session.isActingAdmin).toBe(true)
}

function withActivePlayers(
    session: PerspectiveSession,
    activePlayerIds: string[]
): HydratedPrivateHandState {
    const state = session.gameState.dehydrate()
    state.activePlayerIds = activePlayerIds
    return session.runtime.hydrator.hydrateState(state)
}

function expectPerspective(
    session: PerspectiveSession,
    expected: { playerId: string | undefined; isMyTurn: boolean }
) {
    expect(session.perspectiveIn(session.gameState)).toEqual({
        player: session.myPlayer,
        isMyTurn: session.isMyTurn
    })
    expect(session.myPlayer?.id).toBe(expected.playerId)
    expect(session.isMyTurn).toBe(expected.isMyTurn)
}

describe('GameSession perspectiveIn(gameState) matches myPlayer and isMyTurn', () => {
    test("hotseat presents the active player rather than the user's own, with the turn", async () => {
        const { session } = await openSession({
            hotseat: true,
            userId: 'p1',
            activePlayerIds: ['p2']
        })
        expectPerspective(session, { playerId: 'p2', isMyTurn: true })
    })

    test('hotseat non-active-player view presents a non-active player without the turn', async () => {
        const { session } = await openSession({ hotseat: true, userId: 'p1' })
        expect(session.canViewAsNonActivePlayer).toBe(true)
        session.setViewingAsNonActivePlayer(true)
        await settle(session)
        expect(session.isViewingAsNonActivePlayer).toBe(true)
        expectPerspective(session, { playerId: 'p2', isMyTurn: false })
    })

    test('acting admin presents the chosen active player', async () => {
        const { session, authorization } = await openSession({
            hotseat: true,
            userId: 'p1',
            activePlayerIds: ['p1', 'p2']
        })
        await enableAdmin(authorization, session)
        expect(session.adminPlayerId).toBeUndefined()
        expectPerspective(session, { playerId: 'p1', isMyTurn: true })

        session.setActingPlayer('p2')
        await settle(session)
        expect(session.adminPlayerId).toBe('p2')
        expectPerspective(session, { playerId: 'p2', isMyTurn: true })
    })

    test("acting admin presents the single active player instead of the user's own", async () => {
        const { session, authorization } = await openSession({ hotseat: false, userId: 'p2' })
        expectPerspective(session, { playerId: 'p2', isMyTurn: false })

        await enableAdmin(authorization, session)
        expect(session.adminPlayerId).toBe('p1')
        expectPerspective(session, { playerId: 'p1', isMyTurn: true })
    })

    test('a host player perspective presents that player, even in a hotseat game', async () => {
        const { session } = await openSession({
            hotseat: true,
            userId: 'harness-user',
            hostPerspective: p2
        })
        expect(session.isViewingHost).toBe(false)
        expectPerspective(session, { playerId: 'p2', isMyTurn: false })
    })

    test('a host spectator perspective presents no player', async () => {
        const { session } = await openSession({
            hotseat: true,
            userId: 'harness-user',
            hostPerspective: spectator
        })
        expectPerspective(session, { playerId: undefined, isMyTurn: false })
    })

    test('Host View in a hotseat game presents the first active player', async () => {
        const { session } = await openSession({
            hotseat: true,
            userId: 'harness-user',
            hostPerspective: spectator
        })
        await session.setPrivilegedGameViewEnabled(true)
        await settle(session)
        expect(session.isViewingHost).toBe(true)
        expectPerspective(session, { playerId: 'p1', isMyTurn: true })
    })

    test('exploring presents the first active player of the exploration', async () => {
        const { session } = await openSession({ hotseat: false, userId: 'p2' })
        expectPerspective(session, { playerId: 'p2', isMyTurn: false })

        await session.startExploring()
        await settle(session)
        expect(session.isExploring).toBe(true)
        expectPerspective(session, { playerId: 'p1', isMyTurn: true })
    })

    test('a session user who is the active player has the turn in a non-hotseat game', async () => {
        const { session } = await openSession({ hotseat: false, userId: 'p1' })
        expectPerspective(session, { playerId: 'p1', isMyTurn: true })
    })

    test('a session user who is not active keeps their player without the turn', async () => {
        const { session } = await openSession({ hotseat: false, userId: 'p2' })
        expectPerspective(session, { playerId: 'p2', isMyTurn: false })
    })

    test('a spectator in a non-hotseat game has no player', async () => {
        const { session } = await openSession({ hotseat: false, userId: 'watcher' })
        expectPerspective(session, { playerId: undefined, isMyTurn: false })
    })
})

describe('GameSession perspectiveIn(state) for a state not yet published', () => {
    test('hotseat previews the player the incoming state will present', async () => {
        const { session } = await openSession({ hotseat: true, userId: 'p1' })
        const incoming = withActivePlayers(session, ['p2'])

        expect(session.myPlayer?.id).toBe('p1')
        const preview = session.perspectiveIn(incoming)
        expect(preview.player?.id).toBe('p2')
        expect(preview.isMyTurn).toBe(true)
    })

    test('acting admin previews the single active player of the incoming state', async () => {
        const { session, authorization } = await openSession({
            hotseat: false,
            userId: 'watcher'
        })
        await enableAdmin(authorization, session)
        expect(session.myPlayer?.id).toBe('p1')
        const incoming = withActivePlayers(session, ['p2'])

        const preview = session.perspectiveIn(incoming)
        expect(preview.player?.id).toBe('p2')
        expect(preview.isMyTurn).toBe(true)
    })

    test('a waiting player sees the turn arrive in the incoming state', async () => {
        const { session } = await openSession({ hotseat: false, userId: 'p2' })
        const incoming = withActivePlayers(session, ['p2'])

        expect(session.isMyTurn).toBe(false)
        expect(session.perspectiveIn(incoming)).toEqual({
            player: session.myPlayer,
            isMyTurn: true
        })
    })
})
