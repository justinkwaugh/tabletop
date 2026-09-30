const HEX_COLOR = /^#([0-9a-f]{6})$/i

function channels(color: string): number[] | undefined {
    const match = HEX_COLOR.exec(color)
    if (!match) {
        return undefined
    }
    const value = match[1]
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
}

export function mixColor(color: string, target: string, amount: number): string {
    const from = channels(color)
    const to = channels(target)
    if (!from || !to) {
        return color
    }
    return `#${from
        .map((channel, index) =>
            Math.round(channel * (1 - amount) + to[index] * amount)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`
}

export function lighten(color: string, amount: number): string {
    return mixColor(color, '#ffffff', amount)
}

export function darken(color: string, amount: number): string {
    return mixColor(color, '#1a1208', amount)
}
