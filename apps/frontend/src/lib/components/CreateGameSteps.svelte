<script lang="ts">
    import { untrack } from 'svelte'
    import { MediaQuery } from 'svelte/reactivity'
    import { GameEditForm, type GameUiDefinition } from '@tabletop/frontend-components'
    import type { Game, GameState, HydratedGameState } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { playerCountText, titleMaturityLabel } from '$lib/utils/libraryTitles'
    import { titleMatchesSearch, type TitleGameCounts } from '$lib/utils/seriesLobby'

    type Title = GameUiDefinition<GameState, HydratedGameState>

    let {
        titles,
        counts,
        initialTitleId,
        oncancel,
        onsave
    }: {
        titles: Title[]
        counts?: Map<string, TitleGameCounts>
        initialTitleId?: string
        oncancel: () => void
        onsave: (game: Game) => void
    } = $props()
    const { libraryService } = getAppContext()
    const finePointer = new MediaQuery('(pointer: fine)')

    let pickedId = $state(untrack(() => initialTitleId))
    let search = $state('')
    const picked = $derived(titles.find((title) => title.info.id === pickedId))
    const matching = $derived(
        titles.filter((title) => titleMatchesSearch(title.info.metadata, search))
    )

    function changeTitle() {
        pickedId = undefined
        search = ''
    }

    function focusStep(step: HTMLElement) {
        const target = finePointer.current
            ? step.querySelector('input')
            : step.querySelector<HTMLElement>('h3')
        // flowbite's Dialog moves focus to [data-autofocus] once it opens
        target?.setAttribute('data-autofocus', '')
        target?.focus({ preventScroll: true })
    }
</script>

{#if picked}
    <div class="step" {@attach focusStep}>
        <div class="heading">
            {#if titles.length > 1}
                <button class="change" onclick={changeTitle}>← Change title</button>
            {/if}
            <div class="picked">
                <img src={picked.info.thumbnailUrl} alt="" />
                <h3 tabindex="-1">
                    {picked.info.metadata.name}
                </h3>
            </div>
        </div>
        <GameEditForm title={picked} showHeading={false} {oncancel} {onsave} />
    </div>
{:else}
    <div class="step list-step" {@attach focusStep}>
        <div class="heading">
            <h3 tabindex="-1">Start a game</h3>
            <p class="subheading">Pick a title</p>
        </div>
        {#if libraryService.loading}
            <p class="status" role="status">Loading titles…</p>
        {:else}
            <input
                class="search"
                type="search"
                placeholder={`Search ${titles.length} titles`}
                aria-label="Search titles"
                bind:value={search}
            />
            <div class="titles" style:--title-count={titles.length}>
                <ul aria-label="Titles">
                    {#each matching as title (title.info.id)}
                        {@const metadata = title.info.metadata}
                        {@const maturity = titleMaturityLabel(metadata)}
                        {@const openTables = counts?.get(title.info.id)?.open ?? 0}
                        <li>
                            <button class="title" onclick={() => (pickedId = title.info.id)}>
                                <img src={title.info.thumbnailUrl} alt="" />
                                <span class="name">{metadata.name}</span>
                                <span class="facts"
                                    >{playerCountText(metadata)}{#if maturity}<span class="maturity"
                                            >{maturity}</span
                                        >{/if}</span
                                >
                                {#if openTables > 0}<span class="open-tables"
                                        >{openTables} open</span
                                    >{/if}
                                <span class="chevron" aria-hidden="true">›</span>
                            </button>
                        </li>
                    {/each}
                </ul>
                {#if matching.length === 0}
                    <p class="status">No title matches “{search.trim()}”.</p>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .step {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 0;
    }
    .list-step {
        flex: 1;
    }
    .heading {
        min-width: 0;
        padding-right: 32px;
        font-family: 'Inter', sans-serif;
    }
    h3 {
        color: var(--color-gray-100);
        font-size: 24px;
        font-weight: 500;
        line-height: 1.2;
    }
    h3:focus {
        outline: none;
    }
    .subheading {
        margin-top: 4px;
        color: var(--color-gray-400);
        font-size: 13px;
    }
    .change {
        margin-bottom: 8px;
        color: var(--color-blue-300);
        font-size: 13px;
        font-weight: 500;
    }
    .change:hover {
        text-decoration: underline;
    }
    .change:focus-visible,
    .title:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: -2px;
    }
    .picked {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .picked img {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        object-fit: contain;
    }
    .search {
        padding: 9px 12px;
        border: 1px solid var(--color-gray-600);
        border-radius: 8px;
        background: var(--color-gray-800);
        color: var(--color-gray-100);
        font-size: 14px;
    }
    .search:focus {
        border-color: var(--color-blue-400);
        outline: none;
        box-shadow: none;
    }
    .titles {
        height: min(calc(var(--title-count) * 57px), 470px, 56vh);
        overflow-y: auto;
        overscroll-behavior: contain;
        border-top: 1px solid var(--color-gray-800);
    }
    .title {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto 10px;
        grid-template-areas: 'cover name open chevron' 'cover facts open chevron';
        align-content: center;
        align-items: center;
        column-gap: 12px;
        width: 100%;
        height: 57px;
        padding: 0 6px;
        border-bottom: 1px solid var(--color-gray-800);
        border-radius: 6px;
        text-align: left;
    }
    .title:hover {
        background: var(--color-gray-800);
    }
    .title img {
        grid-area: cover;
        width: 36px;
        height: 36px;
        object-fit: contain;
    }
    .name {
        grid-area: name;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-gray-100);
        font-size: 14px;
    }
    .facts {
        grid-area: facts;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-gray-500);
        font-size: 12px;
    }
    .maturity {
        color: var(--color-orange-300);
    }
    .open-tables {
        grid-area: open;
        color: var(--color-green-400);
        font-size: 12px;
        white-space: nowrap;
    }
    .chevron {
        grid-area: chevron;
        color: var(--color-gray-500);
    }
    .status {
        padding: 14px 6px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    @media (width < 40rem) {
        .search {
            font-size: 16px;
        }
        .titles {
            flex: 1;
            height: auto;
            min-height: 0;
        }
        .title {
            height: 64px;
            padding: 0 4px;
        }
        .name {
            font-size: 15px;
        }
    }
</style>
