import type { GameDefinition } from '@tabletop/common'

export class TitleLibrary<T = GameDefinition> {
    constructor(
        readonly get: (id: string) => T | undefined,
        readonly all: () => Record<string, T>
    ) {}
}

export type TitleLookup<T = GameDefinition> = Record<string, T> | TitleLibrary<T>

export function lookupTitle<T>(titles: TitleLookup<T>, id: string): T | undefined {
    return titles instanceof TitleLibrary ? titles.get(id) : titles[id]
}

export function lookupTitles<T>(titles: TitleLookup<T>): Record<string, T> {
    return titles instanceof TitleLibrary ? titles.all() : titles
}
