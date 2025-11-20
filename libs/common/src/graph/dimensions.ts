export type DimensionsRectangle = {
    width: number
    height: number
}

export type DimensionsCube = {
    width: number
    height: number
    depth: number
}

export type DimensionsCircle = {
    radius: number
}

export type DimensionsEllipse = {
    xRadius: number
    yRadius: number
}

export type BoundingBox = {
    x: number
    y: number
    width: number
    height: number
}

export type HexDimensions = DimensionsCircle | DimensionsEllipse | DimensionsRectangle

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

export function isEllipseDimensions(dimensions: unknown): dimensions is DimensionsEllipse {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'xRadius' in dimensions &&
        'yRadius' in dimensions &&
        typeof (dimensions as any).xRadius === 'number' &&
        typeof (dimensions as any).yRadius === 'number'
    )
}

export function isCircleDimensions(dimensions: unknown): dimensions is DimensionsCircle {
    return (
        typeof dimensions === 'object' &&
        dimensions !== null &&
        'radius' in dimensions &&
        typeof (dimensions as any).radius === 'number'
    )
}
