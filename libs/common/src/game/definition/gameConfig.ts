import { Type, type Static } from '@sinclair/typebox'

export enum ConfigOptionType {
    Boolean = 'Boolean',
    List = 'List'
}

export type BaseConfigOption = Static<typeof BaseConfigOption>
export const BaseConfigOption = Type.Object({
    type: Type.Enum(ConfigOptionType),
    name: Type.String(),
    description: Type.String()
})

export type BooleanConfigOption = Static<typeof BooleanConfigOption>
export const BooleanConfigOption = Type.Object({
    ...BaseConfigOption.properties,
    type: Type.Literal(ConfigOptionType.Boolean),
    default: Type.Boolean()
})

export type ListConfigOption = Static<typeof BooleanConfigOption>
export const ListConfigOption = Type.Object({
    ...BaseConfigOption.properties,
    type: Type.Literal(ConfigOptionType.List),
    default: Type.String(),
    options: Type.Array(
        Type.Object({
            name: Type.String(),
            value: Type.String()
        })
    )
})

export type ConfigOption = Static<typeof ConfigOption>
export const ConfigOption = Type.Union([BooleanConfigOption, ListConfigOption])

export function isListConfigOption(option: ConfigOption): option is ListConfigOption {
    return option.type === ConfigOptionType.List
}

export function isBooleanConfigOption(option: ConfigOption): option is BooleanConfigOption {
    return option.type === ConfigOptionType.Boolean
}

export type GameConfigOptions = Static<typeof GameConfigOptions>
export const GameConfigOptions = Type.Array(ConfigOption)

export type GameConfig = Static<typeof GameConfig>
export const GameConfig = Type.Object({})
