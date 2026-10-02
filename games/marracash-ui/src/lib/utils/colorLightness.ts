type Hsl = { hue: number; saturation: number; lightness: number }

function hexChannels(hex: string): number[] {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}

function channelsToHex(channels: number[]): string {
    return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function hexToHsl(hex: string): Hsl {
    const [red, green, blue] = hexChannels(hex).map((channel) => channel / 255)
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const chroma = max - min
    const lightness = (max + min) / 2
    const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))
    const hue =
        chroma === 0
            ? 0
            : max === red
              ? 60 * (((green - blue) / chroma + 6) % 6)
              : max === green
                ? 60 * ((blue - red) / chroma + 2)
                : 60 * ((red - green) / chroma + 4)
    return { hue, saturation, lightness }
}

function hslToHex({ hue, saturation, lightness }: Hsl): string {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
    const channel = (offset: number) => {
        const position = (offset + hue / 30) % 12
        return lightness - (chroma / 2) * Math.max(-1, Math.min(position - 3, 9 - position, 1))
    }
    return channelsToHex([0, 8, 4].map((offset) => channel(offset) * 255))
}

export function withLightness(hex: string, lightness: number): string {
    const { hue, saturation } = hexToHsl(hex)
    return `hsl(${hue} ${saturation * 100}% ${lightness * 100}%)`
}

export function shiftLightness(hex: string, amount: number): string {
    const hsl = hexToHsl(hex)
    return hslToHex({ ...hsl, lightness: Math.max(0, Math.min(1, hsl.lightness + amount)) })
}

export function mixColors(from: string, to: string, amount: number): string {
    const target = hexChannels(to)
    return channelsToHex(
        hexChannels(from).map((channel, index) => channel + (target[index] - channel) * amount)
    )
}
