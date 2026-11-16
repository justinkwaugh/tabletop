import * as Type from 'typebox'

export enum PieceKind {
    Basic = 'basic',
    Gipf = 'gipf',
    Tamsk = 'tamsk',
    Zertz = 'zertz',
    Dvonn = 'dvonn',
    Yinsh = 'yinsh',
    Punct = 'punct'
}

export type PotentialKind = Exclude<PieceKind, PieceKind.Basic | PieceKind.Gipf>
export const PotentialKind = Type.Union([
    Type.Literal(PieceKind.Tamsk),
    Type.Literal(PieceKind.Zertz),
    Type.Literal(PieceKind.Dvonn),
    Type.Literal(PieceKind.Yinsh),
    Type.Literal(PieceKind.Punct)
])

export const POTENTIAL_KINDS: readonly PotentialKind[] = [
    PieceKind.Tamsk,
    PieceKind.Zertz,
    PieceKind.Dvonn,
    PieceKind.Yinsh,
    PieceKind.Punct
]

export function isPotentialKind(kind: PieceKind): kind is PotentialKind {
    return kind !== PieceKind.Basic && kind !== PieceKind.Gipf
}

export type PotentialCounts = Type.Static<typeof PotentialCounts>
export const PotentialCounts = Type.Object({
    [PieceKind.Tamsk]: Type.Integer({ minimum: 0 }),
    [PieceKind.Zertz]: Type.Integer({ minimum: 0 }),
    [PieceKind.Dvonn]: Type.Integer({ minimum: 0 }),
    [PieceKind.Yinsh]: Type.Integer({ minimum: 0 }),
    [PieceKind.Punct]: Type.Integer({ minimum: 0 })
})

export function countsOfEachKind(count: (kind: PotentialKind) => number): PotentialCounts {
    return {
        [PieceKind.Tamsk]: count(PieceKind.Tamsk),
        [PieceKind.Zertz]: count(PieceKind.Zertz),
        [PieceKind.Dvonn]: count(PieceKind.Dvonn),
        [PieceKind.Yinsh]: count(PieceKind.Yinsh),
        [PieceKind.Punct]: count(PieceKind.Punct)
    }
}

// A potential unit on its own is one already used. Each disc takes an id, bottom first, as it
// enters the board, so the table turns it the same way wherever it goes.
export type Unit = Type.Static<typeof Unit>
export const Unit = Type.Object({
    playerId: Type.String(),
    kind: Type.Enum(PieceKind),
    load: Type.Optional(PotentialKind),
    discIds: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1, maxItems: 2 })
})

export function isLoaded(unit: Unit | undefined): boolean {
    return unit?.kind === PieceKind.Basic && unit.load !== undefined
}

// General use, rules 7–9: GIPF-pieces and loaded pieces may stay when their row is taken; basic
// pieces and used potentials must go.
export function mayStayInRow(unit: Unit): boolean {
    return unit.kind === PieceKind.Gipf || isLoaded(unit)
}

export const GIPF_PIECE_SIZE = 2

type UnitShape = Pick<Unit, 'kind' | 'load'>

export function basicsIn(unit: UnitShape): number {
    return unit.kind === PieceKind.Gipf ? GIPF_PIECE_SIZE : unit.kind === PieceKind.Basic ? 1 : 0
}

export function discsIn(unit: UnitShape): number {
    return basicsIn(unit) + (isPotentialKind(unit.kind) || unit.load !== undefined ? 1 : 0)
}

export function pushedUnit(playerId: string, kind: PieceKind, firstDiscId: number): Unit {
    const shape: UnitShape = isPotentialKind(kind)
        ? { kind: PieceKind.Basic, load: kind }
        : { kind }
    return {
        playerId,
        ...shape,
        discIds: Array.from({ length: discsIn(shape) }, (_, index) => firstDiscId + index)
    }
}
