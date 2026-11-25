import { error } from '@sveltejs/kit'
import { getAppContext } from '$lib/stores/appContext.svelte'
import { availableSeriesEntries, librarySeriesById } from '$lib/utils/libraryTitles'
import { m } from '$lib/paraglide/messages'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
    const { authorizationService, catalogService } = getAppContext()
    await Promise.all([authorizationService.initialize(), catalogService.whenReady()])
    const { entries } = catalogService
    const series = librarySeriesById(params.seriesId)
    if (
        !series ||
        (entries.length > 0 &&
            availableSeriesEntries(entries, series, authorizationService.getSessionUser())
                .length === 0)
    ) {
        error(404, m.library_series_unavailable())
    }
    return { series }
}
