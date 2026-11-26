import {
    displayedGameOptions,
    nonStandardGameOptions,
    type DisplayedGameOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator,
    type GameOptionValueLabels
} from '@tabletop/common'
import { m } from '$lib/paraglide/messages'

export type { DisplayedGameOption }

function valueLabels(): GameOptionValueLabels {
    return { yes: m.games_option_yes(), no: m.games_option_no(), none: m.games_option_none() }
}

export function configuredGameOptions(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator,
    // Seats are assigned, so an option the seat decides shows that instead of its setting.
    seated = false
): DisplayedGameOption[] {
    return displayedGameOptions(config, definition, valueLabels(), seated)
}

export function gameCardOptions(
    config: GameConfig,
    definition: GameConfigOptions | GameConfigurator
): DisplayedGameOption[] {
    return nonStandardGameOptions(config, definition, valueLabels())
}
