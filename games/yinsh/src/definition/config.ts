import * as Type from 'typebox'
import {
    assertExists,
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

const standardDescription = 'Form three rows to win.'
const blitzDescription = 'The first row wins.'

export const YinshGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Standard: ${standardDescription} Blitz: ${blitzDescription}`,
        default: YinshVersion.Standard,
        options: [
            { name: 'Standard', value: YinshVersion.Standard, description: standardDescription },
            { name: 'Blitz', value: YinshVersion.Blitz, description: blitzDescription }
        ],
        alwaysShow: true
    }
]

export class YinshConfigurator extends BaseConfigurator {
    schema = YinshGameConfig
    options = YinshGameConfigOptions
}

export function versionFromConfig(config: GameConfig): YinshVersion {
    if (config.version === undefined) return YinshVersion.Standard
    const version = Object.values(YinshVersion).find((known) => known === config.version)
    assertExists(version, `Unknown YINSH version ${String(config.version)}`)
    return version
}
