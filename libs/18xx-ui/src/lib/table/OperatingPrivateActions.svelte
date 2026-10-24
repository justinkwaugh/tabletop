<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, purchaseLabel }: { session: EighteenXXSessionView; purchaseLabel: string } =
        $props()
    const canBuy = $derived(session.decisions.companyPurchasesAvailable)
    const onlyOthersSell = $derived(!session.decisions.ownCompanyPurchasesAvailable)
    const canUse = $derived(session.privateActions.powersAvailable)
    const buying = $derived(!!session.privateActions.purchaseSource)
    const usingPowers = $derived(session.privateActions.selection === 'powers')

    // Each button toggles: pressing the open one returns to where the player was.
    function choose(powers: boolean) {
        if (powers ? usingPowers : buying) session.privateActions.close()
        else if (powers) session.privateActions.choosePowers()
        else session.privateActions.openPurchases()
    }
</script>

{#if canBuy || canUse}
    <div class="private-actions">
        {#if canBuy}<button
                class:quiet={onlyOthersSell}
                aria-pressed={buying}
                disabled={!session.decisions.canResolve}
                onclick={() => choose(false)}>{purchaseLabel}</button
            >{/if}
        {#if canUse}<button
                aria-pressed={usingPowers}
                disabled={!session.decisions.canResolve}
                onclick={() => choose(true)}>Use privates</button
            >{/if}
    </div>
{/if}

<style>
    .private-actions {
        display: flex;
        gap: 4px;
        margin: 3px 8px;
    }
    button {
        border: 0;
        border-radius: 4px;
        padding: 3px 10px;
        background: var(--rail-surface-selected, #ded0c2);
        color: var(--rail-text, #51412f);
        font: inherit;
        font-size: 12px;
        white-space: nowrap;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-selected, #cdbba9);
    }
    button.quiet:not(:hover, [aria-pressed='true']) {
        background: transparent;
        color: var(--rail-muted, #968574);
    }
    button[aria-pressed='true'] {
        background: var(--rail-solid, #695543);
        color: #fffaf3;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #695543);
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
