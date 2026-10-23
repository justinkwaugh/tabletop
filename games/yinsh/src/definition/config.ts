import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum YinshVersion {
    Standard = 'Standard',
    Blitz = 'Blitz'
}

export const RINGS_TO_WIN: Record<YinshVersion, number> = {
    [YinshVersion.Standard]: 3,
    [YinshVersion.Blitz]: 1
}

export type YinshGameConfig = Type.Static<typeof YinshGameConfig>
export const YinshGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(YinshVersion))
})

export const YinshGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        description: 'Standard: form three rows to win. Blitz: the first row wins.',
        default: YinshVersion.Standard,
        options: [
            { name: 'Standard', value: YinshVersion.Standard },
            { name: 'Blitz', value: YinshVersion.Blitz }
        ],
        alwaysShow: true
    }
]

export class YinshConfigurator extends BaseConfigurator {
    schema = YinshGameConfig
    options = YinshGameConfigOptions
}

export function versionFromConfig(config: GameConfig): YinshVersion {
    return (
        Object.values(YinshVersion).find((version) => version === config.version) ??
        YinshVersion.Standard
    )
}
