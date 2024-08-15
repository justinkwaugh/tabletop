import chalk, { type ChalkFunction } from 'chalk'

export type Colorizers = Map<string, ChalkFunction>

export class LogColorizer {
    constructor(public colorizers: Colorizers) {}

    colorize(id: string, text: string): string {
        const colorFunc = this.colorizers.get(id) ?? chalk.white
        return colorFunc(text)
    }
}
