/**
 * The board's own drawn shapes for its guild areas and tracks, in a 24 box unless a function takes a
 * size. None comes from a picture.
 */
export const BarrelPath =
    'M6 3 Q12 1 18 3 Q21 12 18 21 Q12 23 6 21 Q3 12 6 3 Z M4.6 8 L19.4 8 M4.6 16 L19.4 16'
export const ChickenPath =
    'M4 14 Q4 8 10 8 L12 8 Q12 4 15 4 Q18 4 18 7 L21 8 L18 10 Q19 16 14 19 L14 21 L11 21 L11 20 Q6 20 4 14 Z'
export const SackPath =
    'M9 3 L15 3 L14 7 Q21 11 20 17 Q19 22 12 22 Q5 22 4 17 Q3 11 10 7 Z M10 7 L14 7'
export const CatapultPath =
    'M3 19 L21 19 L21 21 L3 21 Z M6 19 L12 9 L14 10 L9 19 Z M12 9 L20 3 L21 5 L13 11 Z'
export const RefillPath = 'M4 11 L12 3 L20 11 L15 11 L15 21 L9 21 L9 11 Z'
export const WritPath = 'M6 3 L18 3 L18 21 L6 21 Z M9 8 L15 8 M9 12 L15 12 M9 16 L13 16'
export const SunRays = [0, 45, 90, 135, 180, 225, 270, 315]

/** A pointy-topped hexagon about the origin: a guild's rank space. */
export function hexagonPoints(radius: number): string {
    return Array.from({ length: 6 }, (_, index) => {
        const angle = ((60 * index - 90) * Math.PI) / 180
        return `${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`
    }).join(' ')
}
