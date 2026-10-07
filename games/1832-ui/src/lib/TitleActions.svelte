<script lang="ts">
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const companyName = (companyId: string) =>
        session.presentation.companyNames?.[companyId]?.initials ?? companyId
</script>

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
