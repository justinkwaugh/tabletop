import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import {
    GameEngine,
    PlayerStatus,
    type Game,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition,
    type TransitionKind
} from '@tabletop/frontend-components'
import { Definition, KoenigrufenRuntime, TimesAround } from '@tabletop/koenigrufen'
import { UiDefinition } from '$lib/definitions/definition.js'
import { KoenigrufenUiRuntime } from '$lib/definitions/runtime.js'
import { KoenigrufenGameSession } from './session.svelte.js'

const SEATS = ['p1', 'p2', 'p3', 'p4']

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...KoenigrufenRuntime,
            sessionClass: GameSession,
            colorizer: KoenigrufenUiRuntime.colorizer,
            gameUI: {
                load: async () => {
                    throw Error('The session spec does not render a table')
                },
                mount: () => {
                    throw Error('The session spec does not render a table')
                }
            }
        }
    }
}

const GAME: Game = {
    ...KoenigrufenRuntime.initializer.initializeGame(
        {
            id: 'koenigrufen-session',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 7,
            config: { timesAround: TimesAround.Three },
            players: SEATS.map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    ),
    hotseat: true
}

const open: KoenigrufenGameSession[] = []

afterEach(() => {
    for (const session of open.splice(0)) session.dispose()
})

function openSession(): KoenigrufenGameSession {
    const { initialState } = new GameEngine(KoenigrufenRuntime).startGame(GAME, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: SEATS }
    })
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const session = new KoenigrufenGameSession({
        gameService: appContext.gameService,
        bridgedContext: new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME.id
        }),
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: KoenigrufenUiRuntime,
        game: GAME,
        state: initialState,
        actions: []
    })
    open.push(session)
    flushSync()
    return session
}

describe('the chosen cards and announcements', () => {
    // Only the player on turn chooses, so no other player's action can arrive mid-choice; any new
    // state, the player's own action, Undo, history or a correction, starts the choice afresh.
    it('are cleared by every new state', () => {
        const session = openSession()
        const kinds: TransitionKind[] = [
            'initial',
            'own-action',
            'other-action',
            'reconciliation',
            'undo',
            'history',
            'exploration',
            'view-switch',
            'edit'
        ]
        for (const kind of kinds) {
            expect(session['keepsLocalSelections']({ kind, actions: [], intent: 'actions' })).toBe(
                false
            )
        }
    })
})
