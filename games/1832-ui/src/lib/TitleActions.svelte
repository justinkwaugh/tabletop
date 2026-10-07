<script lang="ts">
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const companyName = (companyId: string) =>
        session.presentation.companyNames?.[companyId]?.initials ?? companyId
    const money = (amount: number) => session.presentation.money(amount)
    const protection = $derived(session.priceProtection)
    const restoredPrice = $derived(
        protection &&
            session.gameState.stockMarket.spaces.find(
                (space) => space.id === protection.sale.fromMarketSpaceId
            )?.price
    )
</script>

{#if protection}
    <header class="title-prompt">
        {#if session.canDecideProtection}
            <span
                >{session.getPlayerName(session.gameState.priceProtection?.sellerPlayerId)} sold
                {protection.sale.shares}
                {companyName(protection.sale.companyId)}
                {protection.sale.shares === 1 ? 'share' : 'shares'} for {money(
                    protection.sale.proceeds
                )}. Buy {protection.sale.shares === 1 ? 'it' : 'them'} to protect the price, returning
                it to {money(restoredPrice ?? 0)}?</span
            >
            <button
                class="action-button inline-action"
                onclick={() => session.protectShares(protection.sale.companyId)}>protect</button
            >
            <button
                class="action-button inline-action"
                onclick={() => session.declineProtection(protection.sale.companyId)}
                >decline</button
            >
        {:else}
            <span
                >{session.getPlayerName(protection.playerId)} may protect the {companyName(
                    protection.sale.companyId
                )} price</span
            >
        {/if}
    </header>
{/if}

{#if session.keyWestChoice && session.canChooseAction}
    <header class="title-prompt">
        <span>Place the Key West token in Miami instead of a station?</span>
        <button
            class="action-button inline-action"
            onclick={() => session.keyWestChoice && session.placeRevenueToken(session.keyWestChoice)}
            >place</button
        >
    </header>
{/if}
{#if session.canBuyCoalRights}
    <header class="title-prompt">
        <span>Buy a West Virginia Coal Fields token for $80, using a yellow tile lay?</span>
        <button class="action-button inline-action" onclick={() => session.buyCoalRights()}
            >buy</button
        >
    </header>
{/if}
{#if session.londonCompanies.length}
    <header class="title-prompt">
        <span>London Investment Company: take a free share of</span>
        {#each session.londonCompanies as { companyId, certificateId } (companyId)}<button
                class="action-button inline-action"
                onclick={() => session.takeLondonShare(certificateId)}
                >{companyName(companyId)}</button
            >{/each}
    </header>
{/if}

<style>
    .title-prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .title-prompt button {
        margin: 0;
    }
</style>
