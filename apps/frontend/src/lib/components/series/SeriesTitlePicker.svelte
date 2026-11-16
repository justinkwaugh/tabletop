<script lang="ts">
    import type { GameCatalogEntry } from '@tabletop/common'
    import {
        pickerTitles,
        shortTitleName,
        type PickerTitle,
        type TitleGameCounts
    } from '$lib/utils/seriesLobby'

    let {
        titles,
        counts,
        selected,
        onchange
    }: {
        titles: GameCatalogEntry[]
        counts: Map<string, TitleGameCounts>
        selected: string[]
        onchange: (titleIds: string[]) => void
    } = $props()

    const id = $props.id()
    let open = $state(false)
    let search = $state('')
    let toggle: HTMLButtonElement | undefined = $state()
    let panel: HTMLDivElement | undefined = $state()
    const groups = $derived(pickerTitles(titles, counts, search))
    const selectedTitles = $derived(titles.filter((title) => selected.includes(title.id)))
    const withOpenTables = $derived(
        titles.filter((title) => (counts.get(title.id)?.open ?? 0) > 0).map((title) => title.id)
    )

    function close() {
        open = false
        search = ''
        toggle?.focus()
    }

    function toggleTitle(titleId: string) {
        onchange(
            selected.includes(titleId)
                ? selected.filter((selectedId) => selectedId !== titleId)
                : [...selected, titleId]
        )
    }

    function closeOnOutsidePointer(event: PointerEvent) {
        if (!open || !(event.target instanceof Node)) return
        if (panel?.contains(event.target) || toggle?.contains(event.target)) return
        close()
    }

    function closeOnEscape(event: KeyboardEvent) {
        if (open && event.key === 'Escape') close()
    }

    function focusSearch(input: HTMLInputElement) {
        if (window.matchMedia('(pointer: fine)').matches) input.focus()
    }
</script>

<svelte:window onpointerdown={closeOnOutsidePointer} onkeydown={closeOnEscape} />

{#snippet titleOption({ entry, counts }: PickerTitle)}
    <label class="option">
        <input
            type="checkbox"
            checked={selected.includes(entry.id)}
            onchange={() => toggleTitle(entry.id)}
        />
        <img src={entry.thumbnailUrl} alt="" />
        <span class="option-name">{entry.metadata.name}</span>
        <span class="option-counts">
            {#if counts.open > 0}<b>{counts.open} open</b>{/if}
            {#if counts.open > 0 && counts.inProgress > 0}<span aria-hidden="true"> · </span>{/if}
            {#if counts.inProgress > 0}{counts.inProgress} in progress{/if}
        </span>
    </label>
{/snippet}

<div class="picker">
    <button
        bind:this={toggle}
        class="toggle"
        class:filtered={selected.length > 0}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onclick={() => (open ? close() : (open = true))}
    >
        {selected.length > 0 ? `Titles · ${selected.length}` : 'All titles'}
        <span class="caret" aria-hidden="true">▾</span>
    </button>
    {#if open}
        <div class="scrim" aria-hidden="true"></div>
        <div bind:this={panel} id={`${id}-panel`} class="panel" role="dialog" aria-label="Titles">
            <div class="sheet-heading">
                <span>Titles</span>
            </div>
            <input
                class="search"
                type="search"
                placeholder={`Search ${titles.length} titles`}
                aria-label="Search titles"
                bind:value={search}
                {@attach focusSearch}
            />
            <div class="presets">
                <button aria-pressed={selected.length === 0} onclick={() => onchange([])}
                    >All</button
                >
                {#if withOpenTables.length > 0}
                    <button onclick={() => onchange(withOpenTables)}>Has open tables</button>
                {/if}
            </div>
            <div class="options">
                {#if groups.active.length > 0}
                    <p class="group">With games now</p>
                    {#each groups.active as title (title.entry.id)}{@render titleOption(
                            title
                        )}{/each}
                {/if}
                {#if groups.quiet.length > 0}
                    <p class="group">No games right now</p>
                    {#each groups.quiet as title (title.entry.id)}{@render titleOption(
                            title
                        )}{/each}
                {/if}
                {#if groups.active.length + groups.quiet.length === 0}
                    <p class="no-match">No title matches “{search.trim()}”.</p>
                {/if}
            </div>
            <div class="footer">
                <button class="clear" disabled={selected.length === 0} onclick={() => onchange([])}
                    >Clear</button
                >
                <button class="done" onclick={close}>Show games</button>
            </div>
        </div>
    {/if}
</div>
{#each selectedTitles as title (title.id)}
    <span class="chip">
        <img src={title.thumbnailUrl} alt="" />
        {shortTitleName(title.metadata)}
        <button aria-label={`Remove ${title.metadata.name}`} onclick={() => toggleTitle(title.id)}
            >✕</button
        >
    </span>
{/each}
{#if selected.length > 1}
    <button class="clear-chips" onclick={() => onchange([])}>Clear</button>
{/if}

<style>
    .picker {
        position: relative;
    }
    .toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid var(--color-gray-600);
        border-radius: 8px;
        background: var(--color-gray-800);
        color: var(--color-gray-200);
        font-size: 13px;
    }
    .toggle.filtered {
        border-color: var(--color-blue-400);
    }
    .caret {
        color: var(--color-gray-400);
        font-size: 11px;
    }
    .panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 30;
        display: flex;
        flex-direction: column;
        width: 420px;
        max-height: min(560px, 70vh);
        border: 1px solid var(--color-gray-600);
        border-radius: 12px;
        background: var(--color-gray-800);
        box-shadow: 0 18px 40px #0009;
    }
    .scrim,
    .sheet-heading {
        display: none;
    }
    .search {
        margin: 12px 12px 8px;
        padding: 7px 10px;
        border: 1px solid var(--color-gray-600);
        border-radius: 8px;
        background: var(--color-gray-900);
        color: var(--color-gray-100);
        font-size: 14px;
    }
    .search:focus {
        border-color: var(--color-blue-400);
        outline: none;
        box-shadow: none;
    }
    .presets {
        display: flex;
        gap: 6px;
        padding: 0 12px 10px;
        border-bottom: 1px solid var(--color-gray-700);
    }
    .presets button {
        padding: 3px 10px;
        border: 1px solid var(--color-gray-600);
        border-radius: 999px;
        color: var(--color-gray-300);
        font-size: 12px;
    }
    .presets button[aria-pressed='true'] {
        border-color: var(--color-blue-400);
        background: #1e3a8a55;
        color: var(--color-blue-200);
    }
    .options {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-bottom: 6px;
    }
    .group {
        padding: 10px 14px 4px;
        color: var(--color-gray-500);
        font-size: 11px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        color: var(--color-gray-200);
        font-size: 13px;
        cursor: pointer;
    }
    .option:hover {
        background: #37415180;
    }
    .option input {
        flex-shrink: 0;
        border-radius: 4px;
    }
    .option img {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        object-fit: contain;
    }
    .option-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .option-counts {
        flex-shrink: 0;
        color: var(--color-gray-500);
        font-size: 11px;
    }
    .option-counts b {
        color: var(--color-green-400);
        font-weight: 500;
    }
    .no-match {
        padding: 16px 14px;
        color: var(--color-gray-400);
        font-size: 13px;
    }
    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        border-top: 1px solid var(--color-gray-700);
    }
    .clear,
    .clear-chips {
        color: var(--color-blue-300);
        font-size: 13px;
        font-weight: 500;
    }
    .clear:disabled {
        color: var(--color-gray-500);
    }
    .done {
        padding: 5px 14px;
        border-radius: 6px;
        background: var(--color-blue-600);
        color: white;
        font-size: 13px;
        font-weight: 500;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 4px 3px 4px;
        border: 1px solid var(--color-blue-400);
        border-radius: 999px;
        background: #1e3a8a55;
        color: var(--color-blue-200);
        font-size: 12px;
    }
    .chip img {
        width: 20px;
        height: 20px;
        object-fit: contain;
    }
    .chip button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        color: var(--color-blue-300);
        font-size: 11px;
    }
    .chip button:hover {
        background: #1e3a8a;
    }
    button:focus-visible,
    .option:has(input:focus-visible) {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 2px;
    }
    @media (max-width: 640px) {
        .scrim {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 29;
            background: #000a;
        }
        .panel {
            position: fixed;
            top: auto;
            right: 0;
            bottom: 0;
            left: 0;
            width: auto;
            max-height: 82dvh;
            border-bottom: 0;
            border-radius: 16px 16px 0 0;
        }
        .sheet-heading {
            display: block;
            padding: 16px 16px 0;
            color: var(--color-gray-100);
            font-size: 16px;
            font-weight: 600;
        }
        .search {
            margin-inline: 16px;
            font-size: 16px;
        }
        .presets {
            padding-inline: 16px;
        }
        .option {
            padding: 9px 16px;
            font-size: 14px;
        }
        .footer {
            padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
        }
        .done {
            padding: 8px 18px;
            font-size: 14px;
        }
    }
</style>
