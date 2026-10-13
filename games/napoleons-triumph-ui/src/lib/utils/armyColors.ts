export interface ArmyColors {
    block: string
    shade: string
    ink: string
}

const SHADE = 0.24
const WASH = '#c9c4b7'
const WASH_AMOUNT = 0.58
const INK_WASH_AMOUNT = 0.3

function channelsOf(hex: string): number[] {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}

function mix(hex: string, towards: string, amount: number): string {
    const target = channelsOf(towards)
    const mixed = channelsOf(hex).map((channel, index) =>
        Math.round(channel + (target[index] - channel) * amount)
    )
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function shadeOf(hex: string): string {
    return mix(hex, '#000000', SHADE)
}

// Dimming is solid paint rather than opacity, so the map never shows through a piece.
export function washedOut(colors: ArmyColors): ArmyColors {
    const block = mix(colors.block, WASH, WASH_AMOUNT)
    return { block, shade: shadeOf(block), ink: mix(colors.ink, block, INK_WASH_AMOUNT) }
}
