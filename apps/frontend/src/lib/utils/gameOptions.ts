import {
    ConfigOptionType,
    isBooleanConfigOption,
    presentedBooleanValue,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export function configuredGameOptions(config: GameConfig, definitions: GameConfigOptions) {
    return Object.entries(config).map(([id, value]) => {
        const option = definitions.find((candidate) => candidate.id === id)
        const selected =
            option?.type === ConfigOptionType.List
                ? option.options.find((choice) => choice.value === value)?.name
                : undefined
        const shown =
            option && isBooleanConfigOption(option) && typeof value === 'boolean'
                ? presentedBooleanValue(option, value)
                : value
        return {
            name: option?.name ?? id,
            value:
                selected ??
                (typeof shown === 'boolean'
                    ? shown
                        ? 'Yes'
                        : 'No'
                    : shown === null
                      ? 'None'
                      : String(shown))
        }
    })
}

export function gameCardOptions(config: GameConfig, definitions: GameConfigOptions) {
    const visibleConfig = Object.fromEntries(
        Object.entries(config).filter(([id, value]) => {
            const option = definitions.find((candidate) => candidate.id === id)
            return option && (option.alwaysShow || value !== (option.default ?? null))
        })
    )
    return configuredGameOptions(visibleConfig, definitions)
}
