<script lang="ts">
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import MergerChoice from './MergerChoice.svelte'
    import type { Session1862 } from './session.svelte.js'
    let { session }: { session: Session1862 } = $props()
    const money = $derived(session.presentation.money)
    const acquiring = $derived(
        session.mergerKind === 'acquire' && session.mergerPartners.length > 0
    )
</script>

{#if session.funding}
    {@const funding = session.funding}
    <TitlePrompt text="The company has no train and cannot pay for the bank’s next.">
        {#if funding.shares}
            {@const shares = funding.shares}
            <button
                class="action-button inline-action"
                onclick={() => session.sellTreasuryShares(funding.companyId, shares)}
                >Sell {shares} of its shares</button
            >
        {/if}
        {#if funding.refinance !== undefined}
            <button
                class="action-button inline-action"
                onclick={() => session.refinance(funding.companyId)}
                >Refinance for {money(funding.refinance)}</button
            >
        {/if}
        {#if funding.bankrupt}
            <button
                class="action-button inline-action"
                onclick={() => session.goBankrupt(funding.companyId)}>Go bankrupt</button
            >
        {/if}
    </TitlePrompt>
{/if}
{#if session.redeemable}
    <TitlePrompt
        text="Redeem a share from the Market for {money(session.redeemable.price)}?"
        answer={{ label: 'redeem', onAct: () => session.redeemShare() }}
    />
{/if}
{#if acquiring && session.mergingCompanyId}
    <MergerChoice
        {session}
        companyId={session.mergingCompanyId}
        label="Acquisition"
        text="Acquire a company joined to this one by track. Shares merge two for one; the other director must agree."
    />
{/if}
