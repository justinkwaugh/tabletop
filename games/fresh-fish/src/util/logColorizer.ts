import chalk from 'chalk'

export type Colorizer = (...text: unknown[]) => string
export type Colorizers = Map<string, Colorizer>

export class LogColorizer {
    constructor(public colorizers: Colorizers = new Map()) {}

    colorize(id: string, text: string): string {
        const colorFunc = this.colorizers.get(id) ?? chalk.white
        return colorFunc(text)
    }
}
