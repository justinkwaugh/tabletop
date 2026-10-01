export enum MarketColor {
    Red = 'red',
    Blue = 'blue',
    Green = 'green',
    Purple = 'purple',
    Yellow = 'yellow'
}

export function emptyColorCounts(): Record<MarketColor, number> {
    return {
        [MarketColor.Red]: 0,
        [MarketColor.Blue]: 0,
        [MarketColor.Green]: 0,
        [MarketColor.Purple]: 0,
        [MarketColor.Yellow]: 0
    }
}
