<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const label = $derived(
        session.clouds ? 'Switch to the matte board' : 'Switch to the cloudy board'
    )
</script>

<button
    type="button"
    class="toggle"
    aria-pressed={session.clouds}
    title={label}
    aria-label={label}
    onclick={() => session.toggleClouds()}
>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18.5h10.5a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 7.3 9.1 4.75 4.75 0 0 0 7 18.5Z"
        ></path>
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
        background: var(--yinsh-panel);
        box-shadow: inset 0 0 0 1px var(--yinsh-panel-edge);
        color: var(--yinsh-ink-quiet);
    }

    .toggle[aria-pressed='true'] {
        color: var(--yinsh-ink);
        box-shadow: inset 0 0 0 1px var(--yinsh-mark);
    }

    .toggle:hover {
        background: rgb(255 255 255 / 0.08);
    }

    svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linejoin: round;
    }
</style>
