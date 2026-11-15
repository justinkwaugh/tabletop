import {
    defaultGameConfig,
    normalizeGameConfig,
    type ConfigOption,
    type GameConfig,
    type TournamentScoring
} from '@tabletop/common'
import type { TabletopApi } from '@tabletop/frontend-components'
import type { LibraryService } from '$lib/services/libraryService.svelte'

type TitleLibrary = Pick<LibraryService, 'titlesById'>
type LibraryTitle = LibraryService['titlesById'][string]

export class CompetitionGameChoice {
    titleId = $state('')
    rawConfig: GameConfig = $state({})
    titlesError = $state('')
    eligibleTitleIds: Set<string> | undefined = $state()
    placementTitleIds: Set<string> | undefined = $state()
    chosenScoring: TournamentScoring = $state('splitWinsV1')
    title = $derived.by(() => this.library.titlesById[this.titleId])
    supportsPlacement = $derived.by(
        () =>
            this.placementTitleIds?.has(this.titleId) ||
            (this.titleId === this.initialTitleId && this.initialScoring === 'placementV1')
    )
    scoring: TournamentScoring = $derived.by(() =>
        this.supportsPlacement ? this.chosenScoring : 'splitWinsV1'
    )
    config = $derived.by(() => normalizeGameConfig(this.rawConfig, this.title?.info.configurator))
    titles = $derived.by(() =>
        Object.values(this.library.titlesById)
            .filter(
                (item) =>
                    this.eligibleTitleIds?.has(item.info.id) || item.info.id === this.initialTitleId
            )
            .sort((a, b) => a.info.metadata.name.localeCompare(b.info.metadata.name))
    )

    constructor(
        private readonly library: TitleLibrary,
        private readonly initialTitleId = '',
        initialConfig: GameConfig = {},
        private readonly initialScoring: TournamentScoring = 'splitWinsV1'
    ) {
        this.titleId = initialTitleId
        this.rawConfig = { ...initialConfig }
        this.chosenScoring = initialScoring
    }

    async loadEligibleTitles(api: Pick<TabletopApi, 'listTournamentTitles'>, failureText: string) {
        try {
            const titles = await api.listTournamentTitles()
            this.eligibleTitleIds = new Set(titles.titleIds)
            this.placementTitleIds = new Set(titles.placementTitleIds ?? [])
        } catch {
            this.titlesError = failureText
        }
    }

    select(titleId: string): LibraryTitle | undefined {
        this.titleId = titleId
        const selected = this.library.titlesById[titleId]
        if (selected) this.rawConfig = defaultGameConfig(selected.info.configurator?.options ?? [])
        return selected
    }

    updateOption(option: ConfigOption, value: string | number | boolean | null) {
        const updated = { ...this.config }
        this.title?.info.configurator?.updateConfig(updated, { id: option.id, value })
        this.rawConfig = updated
    }
}
