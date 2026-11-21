import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export const PlayerCount = 4

// How many times the deal goes around the table; everyone deals equally often.
export enum TimesAround {
    Two = '2',
    Three = '3',
    Four = '4',
    Five = '5'
}

// A house rule: in Trischaken the winners of the first six tricks each take the next talon card,
// shown to everyone, instead of the last trick's winner taking the whole talon.
const trischakenTalonByTrickOption: BooleanConfigOption = {
    id: 'trischakenTalonByTrick',
    type: ConfigOptionType.Boolean,
    name: 'Trischaken: talon by trick',
    description:
        'Winners of the first 6 tricks each reveal and take 1 talon card. Off: the last trick’s winner takes all 6.',
    default: false
}

export type KoenigrufenGameConfig = Type.Static<typeof KoenigrufenGameConfig>
export const KoenigrufenGameConfig = Type.Object({
    timesAround: Type.Enum(TimesAround),
    // Absent in games created before the option existed, which play the standard rule.
    trischakenTalonByTrick: Type.Optional(
        Type.Boolean({ default: trischakenTalonByTrickOption.default })
    )
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
    },
    trischakenTalonByTrickOption
]

export function trischakenTalonByTrick(config: GameConfig | undefined): boolean {
    return config?.trischakenTalonByTrick === true
}

export function dealsFor(timesAround: TimesAround): number {
    return Number(timesAround) * PlayerCount
}

export class KoenigrufenConfigurator extends BaseConfigurator {
    schema = KoenigrufenGameConfig
    options = KoenigrufenGameConfigOptions
}
