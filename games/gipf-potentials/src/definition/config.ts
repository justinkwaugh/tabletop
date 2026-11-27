import * as Type from 'typebox'
import * as Value from 'typebox/value'
import {
    assert,
    assertExists,
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

// A word joiner after each hyphen keeps names such as GIPF-piece whole when a description wraps.
function unbroken(text: string): string {
    return text.replaceAll('-', '-\u2060')
}

const LOADED_PIECES =
    'may push them in on top of basic pieces until they push their first plain basic piece, which forfeits any left.'

const VERSION_DESCRIPTIONS: Record<GipfVersion, string> = {
    [GipfVersion.Standard]: `18 pieces each; three GIPF-pieces each start on the board. Each player has the potentials chosen below and ${LOADED_PIECES}`,
    [GipfVersion.Tournament]: `18 pieces each and an empty board; GIPF-pieces come in before your first other piece. Each player has the potentials chosen below and ${LOADED_PIECES}`,
    [GipfVersion.Ultimate]: `A Tournament start with 21 pieces each; bring in as many GIPF-pieces as you like before your first other piece. Each player has 3 potentials of every kind and ${LOADED_PIECES}`
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
    [PieceKind.Tamsk]:
        'When pushed onto the centre by either player, it gives its owner an extra move.',
    [PieceKind.Zertz]: 'Jumps over a line of pieces.',
    [PieceKind.Dvonn]:
        'Jumps onto an opponent’s adjacent basic piece or DVONN-potential, never a GIPF-piece or another kind of potential.',
    [PieceKind.Yinsh]:
        'Slides any distance along a line, stopping before the first occupied spot (no jumping).',
    [PieceKind.Punct]:
        'Sacrifice it to cover an opponent’s adjacent GIPF-piece with one or two basic pieces (GIPF) from your supply, or jump onto an opponent’s adjacent PÜNCT-potential.'
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
        description: unbroken(
            Object.entries(VERSION_DESCRIPTIONS)
                .map(([version, description]) => `${version}: ${description}`)
                .join(' ')
        ),
        default: GipfVersion.Standard,
        options: Object.values(GipfVersion).map((version) => ({
            name: version,
            value: version,
            description: unbroken(VERSION_DESCRIPTIONS[version])
        })),
        alwaysShow: true
    },
    ...POTENTIAL_KINDS.map((kind) => ({
        id: kind,
        type: ConfigOptionType.List as const,
        name: `${KIND_NAMES[kind]} potentials`,
        description: unbroken(KIND_POWERS[kind]),
        default: String(DEFAULT_POTENTIALS[kind]),
        options: COUNT_VALUES.map((value) =>
            // YINSH is the default kind, so with none of it either the game falls back to it.
            value === '0' && kind === PieceKind.Yinsh
                ? {
                      name: 'None',
                      value,
                      description: unbroken(
                          `${KIND_POWERS[kind]} With no potentials of any kind, the game uses 6 YINSH.`
                      )
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

// Ultimate fixes every potential count, so a stored game says what it plays even when an older
// form, which could not disable the counts, sent others.
export function normalizeGipfPotentialsConfig(config: GameConfig): GameConfig {
    const valid: boolean = Value.Check(GipfPotentialsGameConfig, config)
    assert(valid, `Invalid GIPF with Potentials configuration: ${JSON.stringify(config)}`)
    const fixed = VERSION_RULES[versionFromConfig(config)].potentialsOfEveryKind
    if (fixed === undefined) return config
    const counts = Object.fromEntries(POTENTIAL_KINDS.map((kind) => [kind, String(fixed)]))
    return { ...config, ...counts }
}

export class GipfPotentialsConfigurator extends BaseConfigurator {
    schema = GipfPotentialsGameConfig
    options = GipfPotentialsGameConfigOptions
    normalizeConfig = normalizeGipfPotentialsConfig

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
        assert(chosen === 0 || POTENTIAL_COUNTS.includes(chosen), `Unknown ${kind} potential count`)
        return chosen
    })
}

export function versionFromConfig(config: GameConfig): GipfVersion {
    if (config.version === undefined) return GipfVersion.Standard
    const version = Object.values(GipfVersion).find((known) => known === config.version)
    assertExists(version, `Unknown GIPF version ${String(config.version)}`)
    return version
}

export function whitePlayerFromConfig(config: GameConfig): WhitePlayer {
    if (config.whitePlayer === undefined) return WhitePlayer.Random
    const choice = Object.values(WhitePlayer).find((known) => known === config.whitePlayer)
    assertExists(choice, `Unknown choice of White ${String(config.whitePlayer)}`)
    return choice
}

export function potentialsFromConfig(config: GameConfig): PotentialCounts {
    const fixed = VERSION_RULES[versionFromConfig(config)].potentialsOfEveryKind
    if (fixed !== undefined) {
        return countsOfEachKind(() => fixed)
    }
    const counts = chosenCounts(config)
    return POTENTIAL_KINDS.some((kind) => counts[kind] > 0) ? counts : { ...DEFAULT_POTENTIALS }
}
