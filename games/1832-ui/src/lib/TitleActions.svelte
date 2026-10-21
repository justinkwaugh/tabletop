<script lang="ts">
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const companyName = (companyId: string) => session.companyInitials(companyId)
</script>

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
        <span class="choices"
            >{#each session.londonCompanies as { companyId, certificateId } (companyId)}<button
                    class="action-button inline-action"
                    onclick={() => session.takeLondonShare(certificateId)}
                    >{companyName(companyId)}</button
                >{/each}</span
        >
    </header>
{/if}

<style>
    .title-prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .title-prompt button {
        margin: 0;
    }
    /* A prompt's choices wrap below its question together, never one by one. */
    .choices {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
