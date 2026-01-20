import type { Game, GameState, HydratedGameState, Player } from '@tabletop/common'
import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { writable, type Writable } from 'svelte/store'

export type GameSessionBridgeColors = {
    getPlayerBgColor: (playerId?: string) => string
    getPlayerTextColor: (playerId?: string) => string
}

export class GameSessionBridge<T extends GameState, U extends HydratedGameState<T> & T> {
    readonly isExploring: Writable<boolean>
    readonly gameHotseat: Writable<boolean>
    readonly activePlayers: Writable<Player[]>
    readonly adminPlayerId: Writable<string | undefined>
    readonly myPlayer: Writable<Player | undefined>
    readonly explorationsForGame: Writable<Game[]>
    readonly currentExplorationGame: Writable<Game | undefined>
    readonly hasUnsavedChanges: Writable<boolean>
    readonly isViewingHistory: Writable<boolean>
    readonly gameState: Writable<U | undefined>
    readonly colors: Writable<GameSessionBridgeColors>

    constructor(private session: GameSession<T, U>) {
        this.isExploring = writable(this.session.isExploring)
        this.gameHotseat = writable(this.session.game.hotseat)
        this.activePlayers = writable(this.session.activePlayers)
        this.adminPlayerId = writable(this.session.adminPlayerId)
        this.myPlayer = writable(this.session.myPlayer)
        this.explorationsForGame = writable(this.session.explorationsForGame)
        this.currentExplorationGame = writable(
            this.session.explorations.getCurrentExploration()?.game
        )
        this.hasUnsavedChanges = writable(this.session.explorations.hasUnsavedChanges())
        this.isViewingHistory = writable(this.session.isViewingHistory)
        this.gameState = writable(this.session.gameState)
        this.colors = writable(this.buildColorsSnapshot())
    }

    connect() {
        $effect(() => {
            this.isExploring.set(this.session.isExploring)
            this.gameHotseat.set(this.session.game.hotseat)
            this.activePlayers.set(this.session.activePlayers)
            this.adminPlayerId.set(this.session.adminPlayerId)
            this.myPlayer.set(this.session.myPlayer)
            this.explorationsForGame.set(this.session.explorationsForGame)
            this.currentExplorationGame.set(this.session.explorations.getCurrentExploration()?.game)
            this.hasUnsavedChanges.set(this.session.explorations.hasUnsavedChanges())
            this.isViewingHistory.set(this.session.isViewingHistory)
            this.gameState.set(this.session.gameState)
            this.colors.set(this.buildColorsSnapshot())
        })
    }

    setChosenAdminPlayerId(value: string | undefined) {
        this.session.chosenAdminPlayerId = value
    }

    private buildColorsSnapshot(): GameSessionBridgeColors {
        const bgById = new Map<string, string>()
        const textById = new Map<string, string>()
        for (const player of this.session.game.players) {
            bgById.set(player.id, this.session.colors.getPlayerBgColor(player.id))
            textById.set(player.id, this.session.colors.getPlayerTextColor(player.id))
        }

        const defaultBg = this.session.colors.getPlayerBgColor(undefined)
        const defaultText = this.session.colors.getPlayerTextColor(undefined)

        return {
            getPlayerBgColor: (playerId?: string) =>
                bgById.get(playerId ?? 'unknown') ?? defaultBg,
            getPlayerTextColor: (playerId?: string) =>
                textById.get(playerId ?? 'unknown') ?? defaultText
        }
    }
}
