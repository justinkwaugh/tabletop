<script lang="ts">
    import type { RailroadId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    let {
        railroadId,
        choice
    }: {
        railroadId: RailroadId
        choice?: { label: string; onclick: () => void }
    } = $props()

    const style = $derived(RAILROAD_STYLE[railroadId])
    const gameSession = getGameSession()
    const definition = $derived(gameSession.gameState.map.railroad(railroadId))
</script>

{#if choice}
    <button
        type="button"
        class="certificate choosable"
        style:--rr={style.fill}
        style:--rr-text={style.text}
        aria-label={choice.label}
        title={choice.label}
        onclick={choice.onclick}
    >
        <span class="code">{definition.shortName}</span>
    </button>
{:else}
    <div
        class="certificate"
        style:--rr={style.fill}
        style:--rr-text={style.text}
        title="{definition.name} share"
    >
        <span class="code">{definition.shortName}</span>
    </div>
{/if}

<style>
    .certificate {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 108px;
        height: 50px;
        padding: 0 6px;
        border-radius: 3px;
        background: var(--rr);
        color: var(--rr-text);
        font-family: 'Libre Baskerville', Georgia, serif;
        text-align: center;
        box-shadow:
            inset 0 0 0 3px var(--rr),
            inset 0 0 0 4.5px rgba(255, 255, 255, 0.6),
            0 0 0 1px rgba(0, 0, 0, 0.45);
    }

    .code {
        font-size: 20px;
        font-weight: 700;
        line-height: 1.15;
    }

    .choosable {
        cursor: pointer;
        transition:
            transform 120ms ease,
            box-shadow 120ms ease;
    }

    .choosable:hover,
    .choosable:focus-visible {
        outline: none;
        transform: translateY(-2px);
        box-shadow:
            inset 0 0 0 3px var(--rr),
            inset 0 0 0 4.5px rgba(255, 255, 255, 0.6),
            0 0 0 2px #c8961a,
            0 3px 6px rgba(16, 22, 30, 0.3);
    }

    @media (max-width: 639px) {
        .certificate {
            width: 62px;
            height: 30px;
            padding: 0 3px;
        }

        .code {
            font-size: 13px;
        }
    }
</style>
