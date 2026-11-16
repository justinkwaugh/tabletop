import { flushSync } from 'svelte'
import { GameStorage, type Game, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import { RideTheRailsRuntime, type HydratedRideTheRailsGameState } from '@tabletop/ride-the-rails'
import { createGame } from '@tabletop/ride-the-rails/testing'
import { UiDefinition } from '$lib/definitions/definition.js'
import { RideTheRailsUiRuntime } from '$lib/definitions/runtime.js'
import { RideTheRailsGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...RideTheRailsRuntime,
            sessionClass: GameSession,
            colorizer: RideTheRailsUiRuntime.colorizer,
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

const open: RideTheRailsGameSession[] = []

// A local hotseat session over a fixture state (`buildState`): the deciding seat is the one acting
// once its first presentation is shown, and its actions run through the real engine.
export async function openSessionOn(
    state: HydratedRideTheRailsGameState
): Promise<RideTheRailsGameSession> {
    const game: Game = {
        ...createGame(state.players.length),
        hotseat: true,
        storage: GameStorage.Local
    }
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    // The session keeps its own game; nothing is written to browser storage.
    appContext.gameService.saveGameLocally = async () => undefined
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: game.id
    })
    const session = new RideTheRailsGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: RideTheRailsUiRuntime,
        game,
        state: state.dehydrate(),
        actions: []
    })
    open.push(session)
    flushSync()
    await session.waitForVisibleTransitionSettled()
    flushSync()
    return session
}

export function disposeSessions(): void {
    for (const session of open.splice(0)) session.dispose()
}
