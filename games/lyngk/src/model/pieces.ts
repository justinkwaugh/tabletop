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
