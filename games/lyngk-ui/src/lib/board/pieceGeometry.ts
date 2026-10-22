// A stack is drawn as discs seen at an angle: each face is an ellipse and each disc shows a
// band of its side below the face, so every color in the stack reads. The bottom disc stays on
// its point as the stack grows, so a stack does not shift when pieces land on it.

// Face height as a fraction of its width, and one disc's side as a fraction of the radius.
export const TILT = 0.6
export const SIDE = 0.22

export type Disc = { faceY: number }

export function sideHeight(radius: number): number {
    return radius * SIDE
}

export function stackDiscs(height: number, radius: number): Disc[] {
    const side = sideHeight(radius)
    return Array.from({ length: height }, (_, index) => ({ faceY: -side / 2 - index * side }))
}

// Where the top face of a stack is centred, relative to its point.
export function topFaceY(height: number, radius: number): number {
    return -sideHeight(radius) / 2 - Math.max(height - 1, 0) * sideHeight(radius)
}

// How far a stack reaches above and below its point.
export function stackBounds(height: number, radius: number): { top: number; bottom: number } {
    return {
        top: topFaceY(height, radius) - radius * TILT,
        bottom: sideHeight(radius) / 2 + radius * TILT
    }
}

// Half the height a single piece covers, for framing the board.
export function stackExtent(height: number, radius: number): number {
    const { top, bottom } = stackBounds(height, radius)
    return (bottom - top) / 2
}
