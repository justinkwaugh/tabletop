<script lang="ts">
    // PROTOTYPE: renders the chosen player-area variant and its floating switcher. Dev builds only.
    import { PLAYER_VARIANTS, playerArea } from './campaignMock.svelte.js'
    import VariantDeck from './VariantDeck.svelte'
    import VariantLedger from './VariantLedger.svelte'
    import VariantRows from './VariantRows.svelte'
    import VariantSheets from './VariantSheets.svelte'

    const index = $derived(
        PLAYER_VARIANTS.findIndex((variant) => variant.key === playerArea.variant)
    )
    const current = $derived(PLAYER_VARIANTS[index])

    function step(delta: number) {
        const next =
            PLAYER_VARIANTS[(index + delta + PLAYER_VARIANTS.length) % PLAYER_VARIANTS.length]
        playerArea.setVariant(next.key)
    }

    function onKeydown(event: KeyboardEvent) {
        const target = event.target
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            (target instanceof HTMLElement && target.isContentEditable)
        )
            return
        if (event.key === 'ArrowLeft') step(-1)
        if (event.key === 'ArrowRight') step(1)
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#if playerArea.variant === 'D'}
    <VariantRows />
{:else if playerArea.variant === 'A'}
    <VariantLedger />
{:else if playerArea.variant === 'B'}
    <VariantSheets />
{:else}
    <VariantDeck />
{/if}

{#if import.meta.env.DEV && current}
    <div class="switcher">
        <button type="button" onclick={() => step(-1)} aria-label="Previous variant">◀</button>
        <span>{current.key} · {current.name}</span>
        <button type="button" onclick={() => step(1)} aria-label="Next variant">▶</button>
        <span class="mock">mock campaign, year 2340</span>
    </div>
{/if}

<style>
    .switcher {
        position: fixed;
        left: 50%;
        top: 6px;
        transform: translateX(-50%);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 7px 16px;
        border-radius: 999px;
        background: #fff;
        color: #111;
        font:
            600 14px system-ui,
            sans-serif;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
        white-space: nowrap;
    }
    .switcher button {
        padding: 2px 10px;
        border-radius: 999px;
        background: #111;
        color: #fff;
    }
    .mock {
        font-weight: 400;
        color: #555;
    }
</style>
