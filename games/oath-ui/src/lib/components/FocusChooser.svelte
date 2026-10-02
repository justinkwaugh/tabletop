<script lang="ts">
    import { Region } from '@tabletop/oath'
    import type { FocusView } from '$lib/definitions/boardFocusAreas.js'
    import { regionName } from '$lib/model/names.js'

    // Rule 5 — the board's focus views, beside the zoom buttons; the chosen one is ringed.
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
        left: 84px;
        bottom: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        max-width: calc(100% - 92px);
        padding: 3px;
        border-radius: 8px;
        border: 2px solid rgb(55 65 81);
        background: rgb(0 0 0 / 0.7);
        pointer-events: auto;
    }
    .chooser__view {
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid transparent;
        color: rgb(209 213 219);
        font-size: 13px;
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
