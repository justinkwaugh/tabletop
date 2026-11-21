import * as Type from 'typebox'

export enum PieceColor {
    Ivory = 'ivory',
    Blue = 'blue',
    Red = 'red',
    Green = 'green',
    Black = 'black',
    Joker = 'joker'
}

export const ACTIVE_COLORS: readonly PieceColor[] = [
    PieceColor.Ivory,
    PieceColor.Blue,
    PieceColor.Red,
    PieceColor.Green,
    PieceColor.Black
]

export const PIECES_PER_COLOR_ON_BOARD = 8
export const JOKER_COUNT = 3

// Pieces are numbered color by color, in ACTIVE_COLORS order, and the jokers last, so a joker's
// number tells it from the other two.
export const FIRST_JOKER_ID = ACTIVE_COLORS.length * PIECES_PER_COLOR_ON_BOARD

// Which of the three jokers a piece is, by its number; none for any other piece.
export function jokerNumber(id: number): number | undefined {
    const number = id - FIRST_JOKER_ID
    return number >= 0 && number < JOKER_COUNT ? number : undefined
}

// A piece's colour follows from its number.
export function pieceColor(id: number): PieceColor {
    if (jokerNumber(id) !== undefined) return PieceColor.Joker
    const color = ACTIVE_COLORS[Math.floor(id / PIECES_PER_COLOR_ON_BOARD)]
    if (color === undefined || id < 0 || !Number.isInteger(id)) throw Error(`No piece ${id}`)
    return color
}

export const PIECE_COUNT = FIRST_JOKER_ID + JOKER_COUNT

export const PIECE_COLORS: readonly PieceColor[] = [...ACTIVE_COLORS, PieceColor.Joker]

// Every piece of a colour, by number.
export function piecesOfColor(color: PieceColor): number[] {
    return Array.from({ length: PIECE_COUNT }, (_, id) => id).filter(
        (id) => pieceColor(id) === color
    )
}

// A piece, by its number.
export const PieceId = Type.Integer({ minimum: 0, maximum: PIECE_COUNT - 1 })

// Pieces bottom to top, by number.
export type Pieces = Type.Static<typeof Pieces>
export const Pieces = Type.Array(PieceId, { minItems: 1 })

// Pieces bottom to top, by colour, as the rules and the history read them.
export type Stack = Type.Static<typeof Stack>
export const Stack = Type.Array(Type.Enum(PieceColor))

export function topOf(stack: readonly PieceColor[]): PieceColor | undefined {
    return stack.at(-1)
}

// Jokers stand in for any missing color, so a stack is valid while no real color repeats.
export function hasRepeatedColor(stack: readonly PieceColor[]): boolean {
    const real = stack.filter((color) => color !== PieceColor.Joker)
    return new Set(real).size !== real.length
}

// Who may move a stack: its top color is the mover's own claim, or a color nobody has claimed.
export type ColorRights = {
    owned: readonly PieceColor[]
    neutral: readonly PieceColor[]
}
