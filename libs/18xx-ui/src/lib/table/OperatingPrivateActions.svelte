<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, purchaseLabel }: { session: EighteenXXSessionView; purchaseLabel: string } =
        $props()
    const canBuy = $derived(session.decisions.companyPurchasesAvailable)
    const canUse = $derived(session.privateActions.powersAvailable)
    const buying = $derived(!!session.privateActions.purchaseSource)
    const usingPowers = $derived(session.privateActions.selection === 'powers')
    let menu = $state<HTMLDivElement>()
    let compact = $state<HTMLButtonElement>()
    $effect(() => {
        if (!compact) return
        const observer = new ResizeObserver(([entry]) => {
            if (!entry.contentRect.width && menu?.matches(':popover-open')) menu.hidePopover()
        })
        observer.observe(compact)
        return () => observer.disconnect()
    })
    let expanded = $state(false)
    let position = $state({ top: 0, left: 0 })

    // Each button toggles: pressing the open one returns to where the player was.
    function choose(powers: boolean) {
        menu?.hidePopover()
        if (powers ? usingPowers : buying) session.privateActions.close()
        else if (powers) session.privateActions.choosePowers()
        else
            session.privateActions.choosePurchaseSource(
                session.decisions.companyPurchases.some(
                    (option) =>
                        option.request.seller.kind === 'player' &&
                        option.request.seller.playerId === session.myPlayer?.id
                )
                    ? 'mine'
                    : 'other'
            )
    }
</script>

{#snippet choices()}
    {#if canBuy}<button
            aria-pressed={buying}
            disabled={!session.decisions.canResolve}
            onclick={() => choose(false)}>{purchaseLabel}</button
        >{/if}
    {#if canUse}<button
            aria-pressed={usingPowers}
            disabled={!session.decisions.canResolve}
            onclick={() => choose(true)}>Use privates</button
        >{/if}
{/snippet}

{#if canBuy || canUse}
    <div class="private-actions" class:both={canBuy && canUse}>
        <div class="direct">{@render choices()}</div>
        {#if canBuy && canUse}
            <button
                bind:this={compact}
                class="compact"
                aria-expanded={expanded}
                aria-haspopup="true"
                disabled={!session.decisions.canResolve}
                onclick={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    position = {
                        top: bounds.bottom + 4,
                        left: Math.max(8, Math.min(bounds.right - 168, window.innerWidth - 176))
                    }
                    menu?.togglePopover()
                }}>Privates <span aria-hidden="true">▾</span></button
            >
            <div
                class="menu"
                popover="auto"
                bind:this={menu}
                style:top={`${position.top}px`}
                style:left={`${position.left}px`}
                ontoggle={(event) => (expanded = event.newState === 'open')}
            >
                {@render choices()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .private-actions {
        margin: 3px 8px;
    }
    .direct {
        display: flex;
        gap: 4px;
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
    button[aria-pressed='true'],
    button[aria-expanded='true'] {
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
    .compact {
        display: none;
    }
    .menu {
        position: fixed;
        inset: auto;
        width: 168px;
        box-sizing: border-box;
        margin: 0;
        padding: 4px;
        border: 1px solid var(--rail-border, #b7a58f);
        border-radius: 5px;
        background: var(--rail-surface-raised, #f4ede4);
        box-shadow: 0 5px 18px #0003;
    }
    .menu button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 7px 9px;
    }
    .menu button + button {
        margin-top: 3px;
    }
    /* At 480px or less OperatingSteps gives these actions a row of their own, with room for both. */
    @container (480px < width <= 720px) {
        .both .direct {
            display: none;
        }
        .compact {
            display: inline-block;
        }
    }
</style>
