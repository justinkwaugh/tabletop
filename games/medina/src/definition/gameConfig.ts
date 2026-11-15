import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const teaTilesOption: BooleanConfigOption = {
    id: 'teaTiles',
    type: ConfigOptionType.Boolean,
    name: 'Tea tiles',
    description:
        'Claiming a purple palace earns tea tiles: 3 for the first palace, then 2, then 1. Hand one back to place one piece instead of two on a turn.',
    default: false
}

const hiddenPiecesOption: BooleanConfigOption = {
    id: 'hiddenPieces',
    type: ConfigOptionType.Boolean,
    name: 'Hidden pieces',
    description:
        "Players see only their own piece counts until the game ends. Everyone's rooftops and tiles stay visible.",
    default: false
}

const Schema = Type.Object(
    {
        teaTiles: Type.Optional(Type.Boolean({ default: teaTilesOption.default })),
        hiddenPieces: Type.Optional(Type.Boolean({ default: hiddenPiecesOption.default }))
    },
    { additionalProperties: false }
)

export function playsWithTeaTiles(config: GameConfig | undefined): boolean {
    return config?.teaTiles === true
}

export function hidesPieceCounts(config: GameConfig | undefined): boolean {
    return config?.hiddenPieces === true
}

export class MedinaConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [teaTilesOption, hiddenPiecesOption]
}
