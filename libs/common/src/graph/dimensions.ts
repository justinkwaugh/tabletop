export type DimensionsRectangle = {
    width: number
    height: number
}

export function isRectangleDimensions(dimensions: unknown): dimensions is DimensionsRectangle {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'width' in dimensions &&
        'height' in dimensions &&
        typeof (dimensions as any).width === 'number' &&
        typeof (dimensions as any).height === 'number'
    )
}

export type DimensionsCube = {
    width: number
    height: number
    depth: number
}

export type DimensionsElliptical = {
    xRadius: number
    yRadius: number
}

export function isEllipticalDimensions(dimensions: unknown): dimensions is DimensionsElliptical {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'xRadius' in dimensions &&
        'yRadius' in dimensions &&
        typeof (dimensions as any).xRadius === 'number' &&
        typeof (dimensions as any).yRadius === 'number'
    )
}

export type DimensionsCircle = {
    radius: number
}

export function isCircleDimensions(dimensions: unknown): dimensions is DimensionsCircle {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'radius' in dimensions &&
        typeof (dimensions as any).radius === 'number'
    )
}

export type BoundingBox = {
    x: number
    y: number
    width: number
    height: number
}
