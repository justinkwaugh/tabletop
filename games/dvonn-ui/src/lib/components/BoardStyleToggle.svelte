<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    // The icon shows the board a press switches to.
    const label = $derived(session.graphBoard ? 'Sand board' : 'Graph board')
</script>

<button
    type="button"
    class="toggle"
    title={label}
    aria-label={label}
    onclick={() => session.toggleGraphBoard()}
>
    <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true">
        {#if session.graphBoard}
            <ellipse rx="7.5" ry="5.4" class="imprint"></ellipse>
            <ellipse rx="3" ry="2.2" class="imprint"></ellipse>
        {:else}
            <path d="M -9 4 H 9 M -9 -4 H 9 M -7 8 L 2 -8 M -2 8 L 7 -8 M 7 8 L -2 -8 M 2 8 L -7 -8"
            ></path>
        {/if}
    </svg>
</button>

<style>
    .toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: var(--dvonn-panel);
        box-shadow:
            inset 0 0 0 1px var(--dvonn-panel-edge),
            var(--dvonn-panel-shadow);
        color: var(--dvonn-ink);
    }

    .toggle:hover {
        background: var(--dvonn-panel-hover);
    }

    path,
    .imprint {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.3;
        stroke-linecap: round;
    }
</style>
