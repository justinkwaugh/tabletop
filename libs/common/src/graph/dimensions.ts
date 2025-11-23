import { Point } from './coordinates.js'

export type RectangleDimensions = {
    width: number
    height: number
}

export type CubeDimensions = {
    width: number
    height: number
    depth: number
}

export type CircleDimensions = {
    radius: number
}

export type EllipseDimensions = {
    xRadius: number
    yRadius: number
}

export type HexDimensions = CircleDimensions | EllipseDimensions | RectangleDimensions

export type BoundingBox = Point & RectangleDimensions

export function isRectangleDimensions(dimensions: unknown): dimensions is RectangleDimensions {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'width' in dimensions &&
        'height' in dimensions &&
        typeof (dimensions as any).width === 'number' &&
        typeof (dimensions as any).height === 'number'
    )
}

export function isCubeDimensions(dimensions: unknown): dimensions is CubeDimensions {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'width' in dimensions &&
        'height' in dimensions &&
        'depth' in dimensions &&
        typeof (dimensions as any).width === 'number' &&
        typeof (dimensions as any).height === 'number' &&
        typeof (dimensions as any).depth === 'number'
    )
}

export function isEllipseDimensions(dimensions: unknown): dimensions is EllipseDimensions {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'xRadius' in dimensions &&
        'yRadius' in dimensions &&
        typeof (dimensions as any).xRadius === 'number' &&
        typeof (dimensions as any).yRadius === 'number'
    )
}

export function isCircleDimensions(dimensions: unknown): dimensions is CircleDimensions {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'radius' in dimensions &&
        typeof (dimensions as any).radius === 'number'
    )
}
