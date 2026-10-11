<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BoardView } from '$lib/utils/boardView.js'

    let { onshowcommandtrack, onturn }: { onshowcommandtrack: () => void; onturn: () => void } =
        $props()

    const gameSession = getGameSession()

    let open = $state(false)

    const VIEW_NAMES: Record<BoardView, string> = {
        [BoardView.North]: 'North up',
        [BoardView.French]: 'From the French lines',
        [BoardView.Allied]: 'From the Allied lines'
    }
</script>

<div class="nt-map-menu pointer-events-auto absolute bottom-1 right-1 z-10">
    <div class="nt-map-menu-items" class:nt-map-menu-open={open} id="nt-map-menu-items">
        {#if gameSession.mySide}
            <button type="button" class="nt-map-chip" onclick={onshowcommandtrack}
                >Command track</button
            >
        {/if}
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
            onclick={() => (gameSession.darkBorders = !gameSession.darkBorders)}
            >Darker borders</button
        >
        <button type="button" class="nt-map-chip" aria-label="Turn the map" onclick={onturn}
            >{VIEW_NAMES[gameSession.boardView]}</button
        >
    </div>
    <button
        type="button"
        class="nt-map-chip nt-map-menu-toggle"
        aria-expanded={open}
        aria-controls="nt-map-menu-items"
        onclick={() => (open = !open)}>Map</button
    >
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

    .nt-map-chip.nt-map-menu-toggle {
        display: none;
    }

    .nt-map-chip:hover {
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
