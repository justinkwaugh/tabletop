import { mount, unmount } from 'svelte'
import { PrivateHandHost, info } from '@tabletop/common/test-fixtures/private-hand'
import {
    assertExists,
    Role,
    UserStatus,
    type Game,
    type GameCreationOptions,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import { createHarnessAppContext } from '../../harness/harnessContext.js'
import { GameSession } from '../../model/gameSession.svelte.js'
import { uiRuntime } from '../../model/tests/privateHandSession.fixture.js'
import type { AuthorizationService } from '../../services/authorizationService.js'
import GameEditFormHost from './GameEditFormHost.svelte'

type RecordedCreation = { game: Partial<Game>; options: GameCreationOptions | undefined }

class FormFixtureSession extends GameSession<GameState, HydratedGameState> {}

const creations: RecordedCreation[] = []
let authorization: AuthorizationService | undefined
let mounted: Record<string, unknown> | undefined

// Mounts the real form for an Administrator without the Developer role, in Admin Mode, over the
// harness services; creations are recorded instead of sent anywhere.
export async function mountGameEditForm({ reproductionSeeds }: { reproductionSeeds: boolean }) {
    if (mounted) await unmount(mounted)
    creations.length = 0
    const host = new PrivateHandHost()
    const runtime = {
        ...uiRuntime,
        sessionClass: FormFixtureSession,
        ...(reproductionSeeds ? { randomnessVersion: 1 as const } : {})
    }
    const definition = { info: { ...info, thumbnailUrl: '' }, runtime: async () => runtime }
    const app = createHarnessAppContext(definition)
    app.authorizationService.setSessionUser({
        id: 'harness-user',
        username: 'Admin',
        roles: [Role.User, Role.Admin],
        status: UserStatus.Active,
        externalIds: []
    })
    app.authorizationService.debugViewEnabled = false
    app.authorizationService.adminCapabilitiesEnabled = true
    app.api.searchUsernames = async () => []
    app.gameService.createGame = async (game, options) => {
        creations.push({ game, options })
        return host.game
    }
    authorization = app.authorizationService
    mounted = mount(GameEditFormHost, {
        target: document.body,
        props: { app, title: definition, onsave: () => {} }
    })
}

export function setAdminMode(active: boolean) {
    assertExists(authorization, 'The form is not mounted')
    authorization.adminCapabilitiesEnabled = active
}

export function recordedCreations() {
    return creations.map(({ game, options }) => ({
        seed: game.seed,
        masterSeed: options?.masterSeed,
        unlisted: game.unlisted,
        isPublic: game.isPublic,
        ownerSeated: game.players?.some((player) => player.userId === 'harness-user') ?? false
    }))
}
