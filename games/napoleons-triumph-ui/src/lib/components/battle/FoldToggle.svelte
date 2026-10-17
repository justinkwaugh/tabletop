<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const folded = $derived(gameSession.battlePanelFolded)
</script>

<button
    type="button"
    class="nt-fold"
    aria-expanded={!folded}
    onclick={() => gameSession.setBattlePanelFolded(!folded)}
>
    {folded ? 'Unfold' : 'Fold'}
    <svg viewBox="0 0 12 8" aria-hidden="true" class:nt-fold-down={folded}>
        <path d="M1 6.6 L6 1.6 L11 6.6"></path>
    </svg>
</button>

<style>
    .nt-fold {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        padding: 0 2px;
        font-size: 15px;
        font-style: italic;
        line-height: 1.2;
        white-space: nowrap;
        color: var(--nt-ink);
    }

    .nt-fold:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    svg {
        width: 0.8em;
        height: 0.55em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 160ms ease;
    }

    .nt-fold-down {
        transform: rotate(180deg);
    }

    @media (max-width: 639px) {
        .nt-fold {
            font-size: 13px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        svg {
            transition: none;
        }
    }
</style>
