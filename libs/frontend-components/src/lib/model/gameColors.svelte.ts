import type { GameColorizer } from '$lib/definition/gameColorizer.js'
import type { PlayerColorPalette, PlayerColorValueSet } from '$lib/definition/gameUiDefinition.js'
import { Color, GameState, User, type Game } from '@tabletop/common'
import { ColorblindColorizer } from '$lib/utils/colorblindPalette.js'
import { untrack } from 'svelte'
import { fromStore, type Readable } from 'svelte/store'

export type GameColorPreferencePreview = {
    preferredColorsEnabled: boolean
    colorBlindPalette: boolean
}

type GameColorsAuthorization = {
    user: Readable<User | undefined>
    actAsAdmin: Readable<boolean>
}

type GameColorsContext<T extends GameState> = {
    runtime: {
        colorizer: GameColorizer
        playerColors: Color[]
        playerColorPalette?: PlayerColorPalette
    }
    game: Pick<Game, 'hotseat' | 'players'>
    state: Pick<T, 'players'>
}

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

export class GameColors<T extends GameState> {
    constructor(
        private authorizationBridge: GameColorsAuthorization,
        private gameContext: GameColorsContext<T>
    ) {
        this.sessionUserStore = fromStore(this.authorizationBridge.user)
        this.actAsAdminStore = fromStore(this.authorizationBridge.actAsAdmin)
    }

    private sessionUserStore: { current: User | undefined }
    private actAsAdminStore: { current: boolean }
    private preferencePreview: GameColorPreferencePreview | undefined = $state(undefined)

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
        const gamePlayer = sessionUser?.id
            ? this.gameContext.game.players.find((player) => player.userId === sessionUser?.id)
            : undefined

        const playerCopies = structuredClone(state.players)
        const myPlayer = playerCopies.find((player) => player.playerId === gamePlayer?.id)
        const preferredColor = this.getPreferredColor(sessionUser, myPlayer?.color)
        const conflictingPlayer = playerCopies.find(
            (player) =>
                preferredColor &&
                player.color === preferredColor &&
                player.playerId !== gamePlayer?.id
        )

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

    private getPreferredColor(
        user: User | undefined,
        assignedColor: Color | undefined
    ): Color | undefined {
        const preview = this.preferencePreview
        const preferences = preview ?? user?.preferences
        if (
            !this.gameContext.runtime.colorizer.allowPreferredPlayerColors() ||
            (this.gameContext.game.hotseat && !preview) ||
            !user ||
            !preferences?.preferredColorsEnabled ||
            this.actAsAdminStore.current
        ) {
            return undefined
        }

        const preferredColors = preview
            ? this.getPreviewPreferredColors(assignedColor)
            : (user.preferences?.preferredColors ?? [])
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

    private getPreviewPreferredColors(assignedColor: Color | undefined): Color[] {
        const assignedColors = this.gameContext.runtime.playerColors.filter(
            (color) => color === assignedColor
        )
        const otherColors = this.gameContext.runtime.playerColors.filter(
            (color) => color !== assignedColor
        )
        return [...otherColors, ...assignedColors]
    }

    colorBlind: boolean = $derived.by(() => {
        const preferences = this.preferencePreview ?? this.sessionUserStore.current?.preferences
        return preferences?.colorBlindPalette === true
    })

    setPreferencePreview(preview: GameColorPreferencePreview | undefined): void {
        this.preferencePreview = preview
    }

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
            return (
                colorblindPlayerColorPalette[resolvedColor] ??
                colorblindPlayerColorPalette[Color.Gray]!
            )
        }

        const runtimePalette = this.gameContext.runtime.playerColorPalette
        return runtimePalette?.[resolvedColor] ?? defaultPlayerColorPalette[resolvedColor]!
    }
}
