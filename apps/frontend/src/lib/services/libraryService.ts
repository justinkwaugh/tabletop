import { FreshFishUiDefinition } from '@tabletop/fresh-fish-ui'
// import { BridgesUiDefinition } from '@tabletop/bridges-of-shangri-la-ui'
import { type GameUiDefinition } from '@tabletop/frontend-components'

export class LibraryService {
    private readonly titles = new Map<string, GameUiDefinition>([
        [FreshFishUiDefinition.id, FreshFishUiDefinition]
        // [BridgesUiDefinition.id, BridgesUiDefinition]
    ])

    getTitles(): GameUiDefinition[] {
        return Array.from(this.titles.values())
    }

    getTitle(id: string): GameUiDefinition | undefined {
        return this.titles.get(id)
    }

    getNameForTitle(id: string): string {
        return this.titles.get(id)?.metadata.name ?? 'Unknown Game'
    }

    getThumbnailForTitle(id: string): string {
        return this.titles.get(id)?.thumbnailUrl ?? ''
    }
}
