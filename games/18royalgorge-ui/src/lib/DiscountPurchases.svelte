<script lang="ts">
    import { MintWorkerId } from '@tabletop/18royalgorge'
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import type { MetalPurchase, SessionRoyalGorge } from './session.svelte.js'
    let { session }: { session: SessionRoyalGorge } = $props()
    const money = $derived(session.presentation.money)
    const privateIds = $derived([
        ...new Set(session.metalPurchases.map((purchase) => purchase.privateId))
    ])
    const prompt = (privateId: string) =>
        privateId === MintWorkerId
            ? `Close the ${session.companyName(privateId)} to buy VGC at half price:`
            : `With the ${session.companyName(privateId)}, buy a share a space below its price, held until the next stock round:`
    const label = (purchase: MetalPurchase) =>
        `${purchase.shares === 1 ? '' : `${purchase.shares} `}${session.companyInitials(purchase.companyId)} for ${money(purchase.price)}`
</script>

{#each privateIds as privateId (privateId)}
    <TitlePrompt text={prompt(privateId)}>
        <span class="choices"
            >{#each session.metalPurchases.filter((purchase) => purchase.privateId === privateId) as purchase (`${purchase.companyId}:${purchase.shares}`)}<button
                    class="action-button inline-action"
                    disabled={session.actionsLocked}
                    title="{money(purchase.listPrice)} at the market price"
                    onclick={() => session.buyMetalShares(purchase)}>{label(purchase)}</button
                >{/each}</span
        >
    </TitlePrompt>
{/each}

<style>
    /* A prompt's choices wrap below its question together, never one by one. */
    .choices {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
