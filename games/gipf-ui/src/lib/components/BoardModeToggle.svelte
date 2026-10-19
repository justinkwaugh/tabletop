<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const light = $derived(session.lightBoard)
</script>

<button
    type="button"
    class="toggle"
    title={light ? 'Switch to dark mode' : 'Switch to light mode'}
    onclick={() => session.toggleLightBoard()}
>
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        {#if light}
            <circle cx="12" cy="12" r="4.5"></circle>
            {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle (angle)}
                <line x1="12" y1="2.5" x2="12" y2="5" transform="rotate({angle} 12 12)"></line>
            {/each}
        {:else}
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"></path>
        {/if}
    </svg>
    <span class="max-sm:hidden">{light ? 'Light mode' : 'Dark mode'}</span>
</button>

<style>
    .toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 11px 4px 8px;
        border-radius: 999px;
        background: var(--gipf-panel);
        box-shadow: inset 0 0 0 1px var(--gipf-panel-edge);
        color: var(--gipf-ink);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .toggle:hover {
        background: rgb(255 255 255 / 0.08);
    }

    svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
</style>
