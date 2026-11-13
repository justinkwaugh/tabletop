import * as Type from 'typebox'
import { BaseConfigurator, ConfigOptionType, GameConfigOptions } from '@tabletop/common'

export const PlayerCount = 4

// How many times the deal goes around the table; everyone deals equally often.
export enum TimesAround {
    Two = '2',
    Three = '3',
    Four = '4',
    Five = '5'
}

export type KoenigrufenGameConfig = Type.Static<typeof KoenigrufenGameConfig>
export const KoenigrufenGameConfig = Type.Object({
    timesAround: Type.Enum(TimesAround)
})

export const KoenigrufenGameConfigOptions: GameConfigOptions = [
    {
        id: 'timesAround',
        type: ConfigOptionType.List,
        name: 'Length',
        description: 'How many times the deal goes around the table',
        default: TimesAround.Three,
        options: [
            { name: '2 times around (8 deals)', value: TimesAround.Two },
            { name: '3 times around (12 deals)', value: TimesAround.Three },
            { name: '4 times around (16 deals)', value: TimesAround.Four },
            { name: '5 times around (20 deals)', value: TimesAround.Five }
        ],
        alwaysShow: true
    }
]

export function dealsFor(timesAround: TimesAround): number {
    return Number(timesAround) * PlayerCount
}

export class KoenigrufenConfigurator extends BaseConfigurator {
    schema = KoenigrufenGameConfig
    options = KoenigrufenGameConfigOptions
}
