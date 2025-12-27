import type { GameColorizer } from '$lib/definition/gameColorizer.js'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte.js'
import { Color, GameState, User, type HydratedGameState } from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'
import { ColorblindColorizer } from '$lib/utils/colorblindPalette.js'
import { untrack } from 'svelte'

export class GameColors<T extends GameState, U extends HydratedGameState & T> {
    constructor(
        private authorizationService: AuthorizationService,
        private gameContext: GameContext<T, U>
    ) {}

    private colorizer: GameColorizer = $derived.by(() => {
        return this.colorBlind &&
            this.gameContext.definition.colorizer.supportsColorblindPalette() &&
            !this.authorizationService.actAsAdmin
            ? new ColorblindColorizer()
            : this.gameContext.definition.colorizer
    })

    private playerColorsById = $derived.by(() => {
        // Do we want this to evaluate every time state changes?
        // We only use it to get the list of assigned players/colors
        const state = untrack(() => this.gameContext.state)

        const sessionUser = this.authorizationService.getSessionUser()
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
            !this.gameContext.definition.colorizer.allowPreferredPlayerColors() ||
            this.gameContext.game.hotseat ||
            !user ||
            !user.preferences ||
            !user.preferences.preferredColorsEnabled ||
            this.authorizationService.actAsAdmin
        ) {
            return undefined
        }

        const preferredColors = user.preferences.preferredColors
        let preferredColor: Color | undefined
        let bestRank = 999
        for (const color of this.gameContext.definition.playerColors) {
            const rank = preferredColors.indexOf(color)
            if (rank >= 0 && rank < bestRank) {
                preferredColor = color
                bestRank = rank
            }
        }
        return preferredColor
    }

    colorBlind: boolean = $derived.by(() => {
        const sessionUser = this.authorizationService.getSessionUser()
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
