import type { GameColorizer } from '$lib/definition/gameColorizer.js'
import type {
    PlayerColorPalette,
    PlayerColorValueSet
} from '$lib/definition/gameUiDefinition.js'
import type { AuthorizationBridge } from '$lib/services/bridges/authorizationBridge.svelte.js'
import { Color, GameState, User, type HydratedGameState } from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'
import { ColorblindColorizer } from '$lib/utils/colorblindPalette.js'
import { untrack } from 'svelte'
import { fromStore } from 'svelte/store'

const defaultPlayerColorPalette: PlayerColorPalette = {
    [Color.Red]: {
        fill: '#b91c1c',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Orange]: {
        fill: '#f97316',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#fde047',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Green]: {
        fill: '#16a34a',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Blue]: {
        fill: '#2563eb',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Purple]: {
        fill: '#9333ea',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Pink]: {
        fill: '#ec4899',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Brown]: {
        fill: '#713f12',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Gray]: {
        fill: '#6b7280',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Black]: {
        fill: '#000000',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.White]: {
        fill: '#ffffff',
        text: '#000000',
        contrast: '#000000'
    }
}

const colorblindPlayerColorPalette: PlayerColorPalette = {
    [Color.Red]: {
        fill: '#D55E00',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Orange]: {
        fill: '#E69F00',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Yellow]: {
        fill: '#F0E442',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Green]: {
        fill: '#009E73',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Blue]: {
        fill: '#0072B2',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Purple]: {
        fill: '#CC79A7',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Pink]: {
        fill: '#56B4E9',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Brown]: {
        fill: '#444444',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.Gray]: {
        fill: '#888888',
        text: '#ffffff',
        contrast: '#ffffff'
    },
    [Color.White]: {
        fill: '#FFFFFF',
        text: '#000000',
        contrast: '#000000'
    },
    [Color.Black]: {
        fill: '#000000',
        text: '#ffffff',
        contrast: '#ffffff'
    }
}

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

    getBgColorValue(color: Color): string {
        return this.getColorValueSet(color).fill
    }

    getPlayerBgColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBgColor(playerColor)
    }

    getPlayerBgColorValue(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBgColorValue(playerColor)
    }

    getTextColor(color: Color, asPlayerColor: boolean = false): string {
        return this.colorizer.getTextColor(color, asPlayerColor)
    }

    getTextColorValue(color: Color, asPlayerColor: boolean = false): string {
        const valueSet = this.getColorValueSet(color)
        return asPlayerColor ? valueSet.fill : valueSet.text
    }

    getPlayerTextColor(playerId?: string, asPlayerColor: boolean = false) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getTextColor(playerColor, asPlayerColor)
    }

    getPlayerTextColorValue(playerId?: string, asPlayerColor: boolean = false) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getTextColorValue(playerColor, asPlayerColor)
    }

    getBorderColor(color: Color): string {
        return this.colorizer.getBorderColor(color)
    }

    getBorderColorValue(color: Color): string {
        return this.getColorValueSet(color).fill
    }

    getPlayerBorderColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderColor(playerColor)
    }

    getPlayerBorderColorValue(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderColorValue(playerColor)
    }

    getBorderContrastColor(color: Color): string {
        return this.colorizer.getBorderContrastColor(color)
    }

    getPlayerBorderContrastColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderContrastColor(playerColor)
    }

    private getColorValueSet(color: Color): PlayerColorValueSet {
        const resolvedColor = color ?? Color.Gray
        if (this.colorizer instanceof ColorblindColorizer) {
            return colorblindPlayerColorPalette[resolvedColor] ?? colorblindPlayerColorPalette[Color.Gray]!
        }

        const runtimePalette = this.gameContext.runtime.playerColorPalette
        return runtimePalette?.[resolvedColor] ?? defaultPlayerColorPalette[resolvedColor]!
    }
}
