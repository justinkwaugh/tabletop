import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

const hiddenPiecesOption: BooleanConfigOption = {
    id: 'hiddenPieces',
    type: ConfigOptionType.Boolean,
    name: 'Hidden pieces',
    description:
        "Players see only their own piece counts until the game ends. Everyone's rooftops and tea tiles stay visible.",
    default: false
}

const Schema = Type.Object(
    {
        hiddenPieces: Type.Optional(Type.Boolean({ default: hiddenPiecesOption.default }))
    },
    { additionalProperties: false }
)

export function hidesPieceCounts(config: GameConfig | undefined): boolean {
    return config?.hiddenPieces === true
}

export class MedinaConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [hiddenPiecesOption]
}
