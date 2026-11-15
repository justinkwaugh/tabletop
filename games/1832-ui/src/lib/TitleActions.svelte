<script lang="ts">
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import { CoalRights } from '@tabletop/1832'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const companyName = (companyId: string) => session.companyInitials(companyId)
</script>

{#if session.coalRights.canBuy}
    <TitlePrompt
        text="Buy a West Virginia Coal Fields token for {session.presentation.money(
            CoalRights.price
        )}, using a yellow tile lay?"
        answer={{ label: 'buy', onAct: () => session.coalRights.buy() }}
    />
{/if}
{#if session.londonCompanies.length}
    <TitlePrompt text="London Investment Company: take a free share of">
        <span class="choices"
            >{#each session.londonCompanies as { companyId, certificateId } (companyId)}<button
                    class="action-button inline-action"
                    onclick={() => session.takeLondonShare(certificateId)}
                    >{companyName(companyId)}</button
                >{/each}</span
        >
    </TitlePrompt>
{/if}

<style>
    /* A prompt's choices wrap below its question together, never one by one. */
    .choices {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
