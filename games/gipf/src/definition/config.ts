import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum GipfVersion {
    Basic = 'Basic',
    Standard = 'Standard',
    Tournament = 'Tournament'
}

export type VersionRules = {
    pieces: number
    startsWithGipfPieces: boolean
    hasStartingPosition: boolean
    usesGipfPieces: boolean
}

export const VERSION_RULES: Record<GipfVersion, VersionRules> = {
    [GipfVersion.Basic]: {
        pieces: 15,
        startsWithGipfPieces: false,
        hasStartingPosition: true,
        usesGipfPieces: false
    },
    [GipfVersion.Standard]: {
        pieces: 18,
        startsWithGipfPieces: true,
        hasStartingPosition: true,
        usesGipfPieces: true
    },
    [GipfVersion.Tournament]: {
        pieces: 18,
        startsWithGipfPieces: false,
        hasStartingPosition: false,
        usesGipfPieces: true
    }
}

export type GipfGameConfig = Type.Static<typeof GipfGameConfig>
export const GipfGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(GipfVersion))
})

export const GipfGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        description:
            'Basic: 15 pieces, no GIPF-pieces. Standard: 18 pieces, three GIPF-pieces each start on the board. Tournament: 18 pieces, empty board, GIPF-pieces brought in at will before your first single piece.',
        default: GipfVersion.Standard,
        options: [
            { name: 'Basic', value: GipfVersion.Basic },
            { name: 'Standard', value: GipfVersion.Standard },
            { name: 'Tournament', value: GipfVersion.Tournament }
        ],
        alwaysShow: true
    }
]

export class GipfConfigurator extends BaseConfigurator {
    schema = GipfGameConfig
    options = GipfGameConfigOptions
}

export function versionFromConfig(config: GameConfig): GipfVersion {
    return (
        Object.values(GipfVersion).find((version) => version === config.version) ??
        GipfVersion.Standard
    )
}
