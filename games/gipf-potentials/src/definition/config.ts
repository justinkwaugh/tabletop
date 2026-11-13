import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import {
    countsOfEachKind,
    PieceKind,
    POTENTIAL_KINDS,
    type PotentialCounts,
    type PotentialKind
} from '../model/pieces.js'

export enum GipfVersion {
    Standard = 'Standard',
    Tournament = 'Tournament',
    Ultimate = 'Ultimate'
}

export enum WhitePlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export type VersionRules = {
    pieces: number
    startsWithGipfPieces: boolean
    potentialsOfEveryKind?: number
}

export const VERSION_RULES: Record<GipfVersion, VersionRules> = {
    [GipfVersion.Standard]: { pieces: 18, startsWithGipfPieces: true },
    [GipfVersion.Tournament]: { pieces: 18, startsWithGipfPieces: false },
    [GipfVersion.Ultimate]: { pieces: 21, startsWithGipfPieces: false, potentialsOfEveryKind: 3 }
}

const VERSION_DESCRIPTIONS: Record<GipfVersion, string> = {
    [GipfVersion.Standard]: '18 pieces each; three GIPF-pieces each start on the board.',
    [GipfVersion.Tournament]:
        '18 pieces each and an empty board; GIPF-pieces come in before your first other piece.',
    [GipfVersion.Ultimate]:
        'A Tournament start with 21 pieces each and 3 potentials of every kind; bring in as many GIPF-pieces as you like before your first other piece.'
}

// General use, rule 1: at least 3 of each kind in play; the rules set no total.
export const POTENTIAL_COUNTS = [3, 4, 5, 6]
const DEFAULT_POTENTIALS: PotentialCounts = {
    [PieceKind.Tamsk]: 0,
    [PieceKind.Zertz]: 0,
    [PieceKind.Dvonn]: 0,
    [PieceKind.Yinsh]: 6,
    [PieceKind.Punct]: 0
}

const KIND_NAMES: Record<PotentialKind, string> = {
    [PieceKind.Tamsk]: 'TAMSK',
    [PieceKind.Zertz]: 'ZÈRTZ',
    [PieceKind.Dvonn]: 'DVONN',
    [PieceKind.Yinsh]: 'YINSH',
    [PieceKind.Punct]: 'PÜNCT'
}

const KIND_POWERS: Record<PotentialKind, string> = {
    [PieceKind.Tamsk]: 'an extra move when pushed onto the centre',
    [PieceKind.Zertz]: 'jumps over a line of pieces',
    [PieceKind.Dvonn]: 'jumps onto an adjacent opponent’s piece',
    [PieceKind.Yinsh]: 'slides along a line',
    [PieceKind.Punct]: 'neutralises or takes over an opponent’s GIPF-piece'
}

const COUNT_VALUES = ['0', ...POTENTIAL_COUNTS.map(String)]
const PotentialCount = Type.Optional(Type.Union(COUNT_VALUES.map((value) => Type.Literal(value))))

export type GipfPotentialsGameConfig = Type.Static<typeof GipfPotentialsGameConfig>
export const GipfPotentialsGameConfig = Type.Object({
    version: Type.Optional(Type.Enum(GipfVersion)),
    whitePlayer: Type.Optional(Type.Enum(WhitePlayer)),
    [PieceKind.Tamsk]: PotentialCount,
    [PieceKind.Zertz]: PotentialCount,
    [PieceKind.Dvonn]: PotentialCount,
    [PieceKind.Yinsh]: PotentialCount,
    [PieceKind.Punct]: PotentialCount
})

export const GipfPotentialsGameConfigOptions: GameConfigOptions = [
    {
        id: 'version',
        type: ConfigOptionType.List,
        name: 'Version',
        // Older site forms show only this, so it describes every version.
        description: Object.entries(VERSION_DESCRIPTIONS)
            .map(([version, description]) => `${version}: ${description}`)
            .join(' '),
        default: GipfVersion.Standard,
        options: Object.values(GipfVersion).map((version) => ({
            name: version,
            value: version,
            description: VERSION_DESCRIPTIONS[version]
        })),
        alwaysShow: true
    },
    ...POTENTIAL_KINDS.map((kind) => ({
        id: kind,
        type: ConfigOptionType.List as const,
        name: `${KIND_NAMES[kind]} potentials`,
        description: `Per player; ${KIND_POWERS[kind]}.`,
        default: String(DEFAULT_POTENTIALS[kind]),
        options: COUNT_VALUES.map((value) =>
            // YINSH is the default kind, so with none of it either the game falls back to it.
            value === '0' && kind === PieceKind.Yinsh
                ? {
                      name: 'None',
                      value,
                      description: `Per player; ${KIND_POWERS[kind]}. With no potentials of any kind, the game uses 6 YINSH.`
                  }
                : { name: value === '0' ? 'None' : value, value }
        ),
        alwaysShow: true
    })),
    {
        id: 'whitePlayer',
        type: ConfigOptionType.List,
        name: 'White',
        description: 'Who plays White and goes first.',
        default: WhitePlayer.Random,
        options: [
            { name: 'Random', value: WhitePlayer.Random },
            { name: 'Game creator', value: WhitePlayer.Creator },
            { name: 'Opponent', value: WhitePlayer.Opponent }
        ],
        alwaysShow: true
    }
]

export class GipfPotentialsConfigurator extends BaseConfigurator {
    schema = GipfPotentialsGameConfig
    options = GipfPotentialsGameConfigOptions

    override updateConfig(
        config: GameConfig,
        update: { id: string; value: string | boolean | number | null }
    ) {
        const wasUltimate = versionFromConfig(config) === GipfVersion.Ultimate
        super.updateConfig(config, update)
        const isUltimate = versionFromConfig(config) === GipfVersion.Ultimate
        if (wasUltimate !== isUltimate) {
            const counts = isUltimate ? potentialsFromConfig(config) : DEFAULT_POTENTIALS
            for (const kind of POTENTIAL_KINDS) config[kind] = String(counts[kind])
        }
    }

    isOptionDisabled(config: GameConfig, optionId: string): boolean {
        return (
            versionFromConfig(config) === GipfVersion.Ultimate &&
            POTENTIAL_KINDS.some((kind) => kind === optionId)
        )
    }
}

function chosenCounts(config: GameConfig): PotentialCounts {
    return countsOfEachKind((kind) => {
        const chosen = Number(config[kind] ?? DEFAULT_POTENTIALS[kind])
        return POTENTIAL_COUNTS.includes(chosen) ? chosen : 0
    })
}

export function versionFromConfig(config: GameConfig): GipfVersion {
    return (
        Object.values(GipfVersion).find((version) => version === config.version) ??
        GipfVersion.Standard
    )
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    return (
        Object.values(WhitePlayer).find((choice) => choice === config.whitePlayer) ??
        WhitePlayer.Random
    )
}

export function potentialsFromConfig(config: GameConfig): PotentialCounts {
    const fixed = VERSION_RULES[versionFromConfig(config)].potentialsOfEveryKind
    if (fixed !== undefined) {
        return countsOfEachKind(() => fixed)
    }
    const counts = chosenCounts(config)
    return POTENTIAL_KINDS.some((kind) => counts[kind] > 0) ? counts : { ...DEFAULT_POTENTIALS }
}
