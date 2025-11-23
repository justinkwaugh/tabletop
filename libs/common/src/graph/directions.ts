export type Direction = string

export enum RotationDirection {
    Clockwise = 'clockwise',
    Counterclockwise = 'counterclockwise'
}

export enum CardinalDirection {
    North = 'N',
    East = 'E',
    West = 'W',
    South = 'S'
}

export enum OrdinalDirection {
    Northeast = 'NE',
    Southeast = 'SE',
    Southwest = 'SW',
    Northwest = 'NW'
}

export enum PointyHexDirection {
    East = 'E',
    Southeast = 'SE',
    Southwest = 'SW',
    West = 'W',
    Northwest = 'NW',
    Northeast = 'NE'
}

export enum FlatHexDirection {
    North = 'N',
    Northeast = 'NE',
    Southeast = 'SE',
    South = 'S',
    Southwest = 'SW',
    Northwest = 'NW'
}

export function isCardinalDirection(direction: Direction): direction is CardinalDirection {
    return Object.values(CardinalDirection).includes(direction as CardinalDirection)
}

export function isOrdinalDirection(direction: Direction): direction is OrdinalDirection {
    return Object.values(OrdinalDirection).includes(direction as OrdinalDirection)
}

export function isPointyHexDirection(direction: Direction): direction is PointyHexDirection {
    return Object.values(PointyHexDirection).includes(direction as PointyHexDirection)
}

export function isFlatHexDirection(direction: Direction): direction is FlatHexDirection {
    return Object.values(FlatHexDirection).includes(direction as FlatHexDirection)
}

export const ClockwiseCardinalDirections: CardinalDirection[] = [
    CardinalDirection.North,
    CardinalDirection.East,
    CardinalDirection.South,
    CardinalDirection.West
]

export const ClockwiseOrdinalDirections: OrdinalDirection[] = [
    OrdinalDirection.Northeast,
    OrdinalDirection.Southeast,
    OrdinalDirection.Southwest,
    OrdinalDirection.Northwest
]

export const ClockwiseCardinalAndOrdinalDirections: (CardinalDirection | OrdinalDirection)[] = [
    CardinalDirection.North,
    OrdinalDirection.Northeast,
    CardinalDirection.East,
    OrdinalDirection.Southeast,
    CardinalDirection.South,
    OrdinalDirection.Southwest,
    CardinalDirection.West,
    OrdinalDirection.Northwest
]

export const ClockwisePointyHexDirections: PointyHexDirection[] = [
    PointyHexDirection.East,
    PointyHexDirection.Southeast,
    PointyHexDirection.Southwest,
    PointyHexDirection.West,
    PointyHexDirection.Northwest,
    PointyHexDirection.Northeast
]

export const ClockwiseFlatHexDirections: FlatHexDirection[] = [
    FlatHexDirection.North,
    FlatHexDirection.Northeast,
    FlatHexDirection.Southeast,
    FlatHexDirection.South,
    FlatHexDirection.Southwest,
    FlatHexDirection.Northwest
]
