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

const basicDescription = '15 pieces each, three of them on the board, and no GIPF-pieces.'
const standardDescription = '18 pieces each, and three GIPF-pieces each start on the board.'
const tournamentDescription =
    '18 pieces each and an empty board; bring in GIPF-pieces at will before your first single piece.'

export const GipfGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: `Basic: ${basicDescription} Standard: ${standardDescription} Tournament: ${tournamentDescription}`,
        default: GipfVersion.Standard,
        options: [
            { name: 'Basic', value: GipfVersion.Basic, description: basicDescription },
            { name: 'Standard', value: GipfVersion.Standard, description: standardDescription },
            {
                name: 'Tournament',
                value: GipfVersion.Tournament,
                description: tournamentDescription
            }
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
