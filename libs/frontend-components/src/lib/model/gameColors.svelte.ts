import type { GameColorizer } from '$lib/definition/gameColorizer.js'
import type { AuthorizationBridge } from '$lib/services/bridges/authorizationBridge.svelte.js'
import { Color, GameState, User, type HydratedGameState } from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'
import { ColorblindColorizer } from '$lib/utils/colorblindPalette.js'
import { untrack } from 'svelte'
import { fromStore } from 'svelte/store'

export class GameColors<T extends GameState, U extends HydratedGameState<T> & T> {
    constructor(
        private authorizationBridge: AuthorizationBridge,
        private gameContext: GameContext<T, U>
    ) {
        this.sessionUserStore = fromStore(this.authorizationBridge.user)
        this.actAsAdminStore = fromStore(this.authorizationBridge.actAsAdmin)
    }

    private sessionUserStore: { current: User | undefined }
    private actAsAdminStore: { current: boolean }

    private colorizer: GameColorizer = $derived.by(() => {
        return this.colorBlind &&
            this.gameContext.runtime.colorizer.supportsColorblindPalette() &&
            !this.actAsAdminStore.current
            ? new ColorblindColorizer()
            : this.gameContext.runtime.colorizer
    })

    private playerColorsById = $derived.by(() => {
        // Do we want this to evaluate every time state changes?
        // We only use it to get the list of assigned players/colors
        const state = untrack(() => this.gameContext.state)

        const sessionUser = this.sessionUserStore.current
        const preferredColor = this.getPreferredColor(sessionUser)

        const gamePlayer = sessionUser?.id
            ? this.gameContext.game.players.find((player) => player.userId === sessionUser?.id)
            : undefined

        const playerCopies = structuredClone(state.players)
        const conflictingPlayer = playerCopies.find(
            (player) =>
                preferredColor &&
                player.color === preferredColor &&
                player.playerId !== gamePlayer?.id
        )

        const myPlayer = playerCopies.find((player) => player.playerId === gamePlayer?.id)

        if (preferredColor && myPlayer && myPlayer.color !== preferredColor) {
            const myOriginalColor = myPlayer.color
            myPlayer.color = preferredColor
            if (conflictingPlayer) {
                conflictingPlayer.color = myOriginalColor
            }
        }
        return new Map(
            playerCopies.map((player) => {
                return [player.playerId, player.color]
            })
        )
    })

    private getPreferredColor(user?: User): Color | undefined {
        if (
            !this.gameContext.runtime.colorizer.allowPreferredPlayerColors() ||
            this.gameContext.game.hotseat ||
            !user ||
            !user.preferences ||
            !user.preferences.preferredColorsEnabled ||
            this.actAsAdminStore.current
        ) {
            return undefined
        }

        const preferredColors = user.preferences.preferredColors
        let preferredColor: Color | undefined
        let bestRank = 999
        for (const color of this.gameContext.runtime.playerColors) {
            const rank = preferredColors.indexOf(color)
            if (rank >= 0 && rank < bestRank) {
                preferredColor = color
                bestRank = rank
            }
        }
        return preferredColor
    }

    colorBlind: boolean = $derived.by(() => {
        const sessionUser = this.sessionUserStore.current
        if (!sessionUser || !sessionUser.preferences) {
            return false
        }

        return sessionUser.preferences.colorBlindPalette === true
    })

    getPlayerColor(playerId?: string): Color {
        return this.playerColorsById.get(playerId ?? 'unknown') ?? Color.Gray
    }

    getUiColor(color: Color): string {
        return this.colorizer.getUiColor(color)
    }

    getPlayerUiColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getUiColor(playerColor)
    }

    getBgColor(color: Color): string {
        return this.colorizer.getBgColor(color)
    }

    getPlayerBgColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBgColor(playerColor)
    }

    getTextColor(color: Color, asPlayerColor: boolean = false): string {
        return this.colorizer.getTextColor(color, asPlayerColor)
    }

    getPlayerTextColor(playerId?: string, asPlayerColor: boolean = false) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getTextColor(playerColor, asPlayerColor)
    }

    getBorderColor(color: Color): string {
        return this.colorizer.getBorderColor(color)
    }

    getPlayerBorderColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderColor(playerColor)
    }

    getBorderContrastColor(color: Color): string {
        return this.colorizer.getBorderContrastColor(color)
    }

    getPlayerBorderContrastColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderContrastColor(playerColor)
    }
}
