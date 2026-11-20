import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const threeYellowLaysOption: BooleanConfigOption = {
    id: 'threeYellowLays',
    type: ConfigOptionType.Boolean,
    name: 'Three yellow tiles on a first turn',
    description: 'A major company may lay three yellow tiles, instead of two, on its first turn.',
    default: false
}

const earlyKcmoOption: BooleanConfigOption = {
    id: 'earlyKcmo',
    type: ConfigOptionType.Boolean,
    name: 'Early KCM&O purchase',
    description: 'A major company may buy the KCM&O from a player before phase 3, for up to $40.',
    default: false
}

const delayedMinorCloseOption: BooleanConfigOption = {
    id: 'delayedMinorClose',
    type: ConfigOptionType.Boolean,
    name: 'Delayed minor close',
    description:
        'The minor companies close at the start of the stock round after phase 3½ begins, keeping their 2-trains until then.',
    default: false
}

const hardRustOption: BooleanConfigOption = {
    id: 'hardRust',
    type: ConfigOptionType.Boolean,
    name: '4-trains rust at once',
    description: 'All 4-trains are removed as soon as the second 6-train is bought.',
    default: false
}

const Schema = Type.Object(
    {
        threeYellowLays: Type.Optional(Type.Boolean({ default: false })),
        earlyKcmo: Type.Optional(Type.Boolean({ default: false })),
        delayedMinorClose: Type.Optional(Type.Boolean({ default: false })),
        hardRust: Type.Optional(Type.Boolean({ default: false }))
    },
    { additionalProperties: false }
)

/** The optional rules chosen for the game (rule 8). */
export type OptionsMex = {
    /** 8(a): three yellow lays on a major company's first turn. */
    threeYellowLays?: true
    /** 8(b): the KCM&O may be bought in from a player before phase 3, for up to $40. */
    earlyKcmo?: true
    /** 8(c): the minors close at the next stock round after phase 3½ begins. */
    delayedMinorClose?: true
    /** 8(d): the 4-trains rust at the second 6-train instead of becoming obsolete. */
    hardRust?: true
}

export const GameConfigMex = {
    schema: Schema,
    options: (config: GameConfig | undefined): OptionsMex => ({
        ...(config?.threeYellowLays === true ? { threeYellowLays: true as const } : {}),
        ...(config?.earlyKcmo === true ? { earlyKcmo: true as const } : {}),
        ...(config?.delayedMinorClose === true ? { delayedMinorClose: true as const } : {}),
        ...(config?.hardRust === true ? { hardRust: true as const } : {})
    })
}

export class ConfiguratorMex extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [
        threeYellowLaysOption,
        earlyKcmoOption,
        delayedMinorCloseOption,
        hardRustOption
    ]
}
