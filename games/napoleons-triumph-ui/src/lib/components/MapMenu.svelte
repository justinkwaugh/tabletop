<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardView } from '$lib/utils/boardView.js'
    import SlidingSwitch from './SlidingSwitch.svelte'

    let {
        onview,
        onsavepicture,
        savingPicture
    }: {
        onview: (view: BoardView) => void
        onsavepicture: () => void
        savingPicture: boolean
    } = $props()

    const gameSession = getGameSession()

    let open = $state(false)

    const VIEWS = [
        { value: BoardView.Allied, name: 'Allies' },
        { value: BoardView.French, name: 'French' },
        { value: BoardView.North, name: 'North' }
    ]
</script>

<div class="nt-map-menu pointer-events-auto absolute bottom-1 right-1 z-10">
    <div class="nt-map-menu-items" class:nt-map-menu-open={open} id="nt-map-menu-items">
        <button
            type="button"
            class="nt-map-chip"
            aria-pressed={gameSession.approachSymbolsShown}
            onclick={() => (gameSession.approachSymbolsShown = !gameSession.approachSymbolsShown)}
            >Approach symbols</button
        >
        <button
            type="button"
            class="nt-map-chip"
            aria-pressed={gameSession.darkBorders}
            onclick={() => gameSession.setDarkBorders(!gameSession.darkBorders)}
            >Darker borders</button
        >
        <div class="nt-map-picture">
            <button
                type="button"
                class="nt-map-chip"
                disabled={savingPicture}
                onclick={onsavepicture}>{savingPicture ? 'Saving…' : 'Save image'}</button
            >
            <button
                type="button"
                class="nt-map-chip"
                aria-pressed={gameSession.pictureShowsUnitTypes}
                onclick={() =>
                    (gameSession.pictureShowsUnitTypes = !gameSession.pictureShowsUnitTypes)}
                >with unit types</button
            >
        </div>
        <div class="nt-map-view">
            <SlidingSwitch
                label="See the map from"
                choices={VIEWS}
                chosen={gameSession.boardView}
                onchoose={onview}
            >
                {#snippet mark(view)}
                    {#if view === BoardView.North}
                        <svg viewBox="0 0 10 11" class="nt-map-north" aria-hidden="true">
                            <path d="M5 0.4 L9.7 5.6 H6.7 V10.6 H3.3 V5.6 H0.3 Z"></path>
                        </svg>
                    {/if}
                {/snippet}
            </SlidingSwitch>
        </div>
    </div>
    <button
        type="button"
        class="nt-map-chip nt-map-menu-toggle"
        aria-expanded={open}
        aria-controls="nt-map-menu-items"
        onclick={() => (open = !open)}
    >
        Map
        <svg viewBox="0 0 12 10" class="nt-map-lines" aria-hidden="true">
            <path d="M0.8 1.2 H11.2 M0.8 5 H11.2 M0.8 8.8 H11.2"></path>
        </svg>
    </button>
</div>

<style>
    .nt-map-menu,
    .nt-map-menu-items {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
    }

    .nt-map-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 7px;
        padding: 3px 10px;
        font-size: 12px;
        line-height: 16px;
        background: var(--nt-ground);
        color: var(--nt-ink);
    }

    .nt-map-picture {
        display: flex;
        gap: 3px;
    }

    .nt-map-view {
        display: flex;
        border-radius: 6px;
        background: var(--nt-ground);
    }

    .nt-map-lines {
        flex: none;
        width: 0.95em;
        height: 0.8em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
    }

    .nt-map-north {
        flex: none;
        width: 0.72em;
        height: 0.8em;
        fill: currentColor;
    }

    .nt-map-chip.nt-map-menu-toggle {
        display: none;
    }

    .nt-map-chip:hover:not([disabled]) {
        background: color-mix(in srgb, var(--nt-ground) 90%, var(--nt-ink));
    }

    .nt-map-chip[aria-pressed]::before {
        content: '';
        width: 8px;
        height: 8px;
        border: 1.5px solid currentColor;
        border-radius: 50%;
    }

    .nt-map-chip[aria-pressed='true']::before {
        background: currentColor;
    }

    @media (max-width: 639px) {
        .nt-map-chip.nt-map-menu-toggle {
            display: inline-flex;
        }

        .nt-map-menu-items {
            display: none;
        }

        .nt-map-menu-items.nt-map-menu-open {
            display: flex;
        }

        .nt-map-chip {
            padding: 5px 12px;
            font-size: 13px;
        }
    }
</style>
