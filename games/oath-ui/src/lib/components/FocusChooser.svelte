<script lang="ts">
    import { Region } from '@tabletop/oath'
    import type { FocusView } from '$lib/definitions/boardFocusAreas.js'
    import { regionName } from '$lib/model/names.js'

    // Rule 5 — the board's focus views in one line along the map's top edge; the chosen one is ringed.
    let {
        selected,
        onselect
    }: {
        selected: FocusView | undefined
        onselect: (view: FocusView) => void
    } = $props()

    const VIEWS: { view: FocusView; label: string }[] = [
        { view: 'full', label: 'Full' },
        { view: Region.Cradle, label: regionName(Region.Cradle) },
        { view: Region.Provinces, label: regionName(Region.Provinces) },
        { view: Region.Hinterland, label: regionName(Region.Hinterland) },
        { view: 'banks', label: 'Banks' }
    ]
</script>

<div class="chooser" role="group" aria-label="Focus the board">
    {#each VIEWS as { view, label } (view)}
        <button
            type="button"
            class="chooser__view"
            class:chooser__view--on={selected === view}
            aria-pressed={selected === view}
            onclick={() => onselect(view)}
        >
            {label}
        </button>
    {/each}
</div>

<style>
    .chooser {
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-wrap: nowrap;
        gap: 1px;
        max-width: calc(100% - 8px);
        overflow-x: auto;
        padding: 1px;
        border-radius: 7px;
        border: 1px solid rgb(55 65 81);
        background: rgb(0 0 0 / 0.6);
        pointer-events: auto;
    }
    .chooser__view {
        padding: 1px 8px;
        border-radius: 6px;
        border: 1px solid transparent;
        color: rgb(209 213 219);
        font-size: 12px;
        white-space: nowrap;
        font-weight: 700;
        line-height: 1.3;
    }
    .chooser__view:hover {
        color: var(--oath-text);
    }
    .chooser__view--on {
        border-color: var(--oath-accent);
        background: var(--oath-control);
        color: var(--oath-text);
    }
</style>
