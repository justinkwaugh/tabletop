<script lang="ts">
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    let { session, purchaseLabel }: { session: FinanceExampleSession; purchaseLabel: string } = $props()
    const canBuy = $derived(session.privatePurchases.length > 0)
    const canUse = $derived(session.privatePowersAvailable)
    let menu = $state<HTMLDivElement>()
    let expanded = $state(false)
    let position = $state({ top: 0, left: 0 })

    function choose(powers: boolean) {
        menu?.hidePopover()
        if (powers) session.choosePrivatePowers()
        else session.choosePrivatePurchaseSource(
            session.privatePurchases.some((option) => option.request.seller.kind === 'player' &&
                option.request.seller.playerId === session.myPlayer?.id) ? 'mine' : 'other'
        )
    }
</script>

{#snippet choices()}
    {#if canBuy}<button aria-pressed={!!session.privatePurchaseSource}
        disabled={!session.canResolveCompanyDecision} onclick={() => choose(false)}>{purchaseLabel}</button>{/if}
    {#if canUse}<button aria-pressed={session.privateActionSelection === 'powers'}
        disabled={!session.canResolveCompanyDecision} onclick={() => choose(true)}>Use privates</button>{/if}
{/snippet}

{#if canBuy || canUse}
    <div class="private-actions" class:both={canBuy && canUse}>
        <div class="direct">{@render choices()}</div>
        {#if canBuy && canUse}
            <button class="compact" aria-expanded={expanded} aria-haspopup="true"
                disabled={!session.canResolveCompanyDecision}
                onclick={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    position = { top: bounds.bottom + 4, left: Math.max(8, Math.min(bounds.right - 168, window.innerWidth - 176)) }
                    menu?.togglePopover()
                }}>Privates <span aria-hidden="true">▾</span></button>
            <div class="menu" popover="auto" bind:this={menu}
                style:top={`${position.top}px`} style:left={`${position.left}px`}
                ontoggle={(event) => expanded = event.newState === 'open'}>
                {@render choices()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .private-actions { align-self: center; flex: none; margin: 3px 8px; }
    .direct { display: flex; gap: 4px; }
    button { border: 0; border-radius: 4px; padding: 3px 10px; background: #ded0c2; color: #51412f; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
    button:hover:not(:disabled) { background: #cdbba9; }
    button[aria-pressed='true'], button[aria-expanded='true'] { background: #695543; color: #fffaf3; }
    button:focus-visible { outline: 2px solid #695543; outline-offset: 2px; }
    button:disabled { opacity: .5; cursor: default; }
    .compact { display: none; }
    .menu { position: fixed; inset: auto; width: 168px; box-sizing: border-box; margin: 0; padding: 4px; border: 1px solid #b7a58f; border-radius: 5px; background: #f4ede4; box-shadow: 0 5px 18px #0003; }
    .menu button { display: block; width: 100%; text-align: left; padding: 7px 9px; }
    .menu button + button { margin-top: 3px; }
    @container (max-width: 720px) {
        .both .direct { display: none; }
        .compact { display: inline-block; }
    }
</style>
