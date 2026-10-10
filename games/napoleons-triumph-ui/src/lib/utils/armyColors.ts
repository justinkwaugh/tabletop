export interface ArmyColors {
    block: string
    shade: string
    ink: string
}

const SHADE = 0.76

export function shadeOf(hex: string): string {
    const channels = [1, 3, 5].map((start) =>
        Math.round(parseInt(hex.slice(start, start + 2), 16) * SHADE)
    )
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
