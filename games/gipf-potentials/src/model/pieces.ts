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

// What sits on a spot is a stack of units, bottom to top; only the top unit is in play and gives
// the spot its colour. A basic piece may carry a potential (a loaded piece); a GIPF-piece is two
// basic pieces; a potential unit on its own is one already used. Each disc has an id, bottom
// first, given as it enters the board, by which the table turns it.
export type Unit = Type.Static<typeof Unit>
export const Unit = Type.Object({
    playerId: Type.String(),
    kind: Type.Enum(PieceKind),
    load: Type.Optional(PotentialKind),
    discIds: Type.Array(Type.Integer({ minimum: 0 }))
})

export function isLoaded(unit: Unit | undefined): boolean {
    return unit?.kind === PieceKind.Basic && unit.load !== undefined
}

// General use, rules 7–9: GIPF-pieces and loaded pieces may stay when their row is taken; basic
// pieces and used potentials must go.
export function mayStayInRow(unit: Unit): boolean {
    return unit.kind === PieceKind.Gipf || isLoaded(unit)
}

export function discsOf(unit: Unit): number {
    return unit.kind === PieceKind.Gipf || isLoaded(unit) ? 2 : 1
}
