<script lang="ts">
    import BackLink from '$lib/components/BackLink.svelte'
    import LibraryShelf from '$lib/components/LibraryShelf.svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        availableSeriesEntries,
        gameCount,
        libraryUrl,
        titleShelfItems
    } from '$lib/utils/libraryTitles'

    let { data } = $props()
    const { authorizationService, catalogService } = getAppContext()
    const user = $derived(authorizationService.getSessionUser())
    const titles = $derived(availableSeriesEntries(catalogService.entries, data.series, user))
</script>

<svelte:head>
    <title>{data.series.name} games — Board Together</title>
</svelte:head>

<main class="series-page collection-page">
    <BackLink href={libraryUrl(user)} label="All games" />
    <div class="series-heading">
        <h1 class="collection-heading">{data.series.name}</h1>
        {#if titles.length > 0}
            <span class="series-count">{gameCount(titles.length)}</span>
        {/if}
    </div>
    <p class="series-description">{data.series.description}</p>
    {#if titles.length > 0}
        <LibraryShelf items={titleShelfItems(titles)} signedIn={user !== undefined} />
    {:else}
        <p role="status" class="series-status">
            The game shelf couldn’t load. Please refresh to try again.
        </p>
    {/if}
</main>

<style>
    .series-page {
        padding-bottom: 48px;
        color: var(--color-gray-200);
    }
    .series-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-top: 16px;
    }
    .series-count {
        flex-shrink: 0;
        padding-bottom: 4px;
        color: var(--color-gray-400);
        font-size: 13px;
    }
    .series-status {
        padding: 48px 0;
        color: var(--color-gray-400);
    }
    .series-description {
        max-width: 640px;
        margin: 8px 0 28px;
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.5;
    }
</style>
