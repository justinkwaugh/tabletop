<script lang="ts">
    import { finiteCashOwnedBy } from '@tabletop/18xx'
    import { ConnectionPremium, ownerShareOfTreasury } from '@tabletop/1880'
    import { CompanyToken, SwitchTrack } from '@tabletop/18xx-ui'
    import type { Session1880 } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    let { session }: { session: Session1880 } = $props()
    const money = $derived(session.presentation.money)
    const TokenSize = 40
    // Whether the company's station replaces the investor's, for the merger shown: a new merger
    // starts with it on (§VII).
    let replaceChoice = $state<{ investorId: string; replace: boolean }>()
    const replace = $derived(
        replaceChoice && replaceChoice.investorId === session.merger?.investorId
            ? replaceChoice.replace
            : true
    )
    const pending = $derived(session.merger ?? session.stationChoice)
</script>

{#snippet joining(investorId: string, companyId: string)}
    <div class="joining" aria-hidden="true">
        <CompanyToken appearance={session.mapView.stations[investorId]} size={TokenSize} />
        <svg class="arrow" viewBox="0 0 24 12"><path d="M2 6h17M14 1.5 19.5 6 14 10.5"></path></svg>
        <CompanyToken appearance={session.mapView.stations[companyId]} size={TokenSize} />
    </div>
{/snippet}

{#if session.merger && pending}
    {@const { investorId, companyId } = pending}
    {@const treasury = finiteCashOwnedBy(session.gameState, {
        kind: 'company',
        companyId: investorId
    })}
    <TitlePanel label="Foreign investor joins its company">
        {@render joining(investorId, companyId)}
        <p>
            {session.actionCompanyName(investorId)} has joined {session.actionCompanyName(
                companyId
            )}’s network: you take its share and a {money(ConnectionPremium)} premium. Where does its
            treasury go?
        </p>
        {#if session.mergerReplaces}
            <button
                class="replace-switch"
                role="switch"
                aria-checked={replace}
                disabled={session.busy}
                onclick={() => (replaceChoice = { investorId, replace: !replace })}
                ><SwitchTrack on={replace} /><span
                    >Replace its token with {session.actionCompanyName(companyId)}’s</span
                ></button
            >
        {/if}
        <div class="choices">
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.mergeInvestor('company', replace && session.mergerReplaces)}
                >{money(treasury)} to {session.actionCompanyName(companyId)}</button
            >
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.mergeInvestor('owner', replace && session.mergerReplaces)}
                >{money(ownerShareOfTreasury(treasury))} to you</button
            >
        </div>
    </TitlePanel>
{:else if session.stationChoice}
    {@const { investorId, companyId } = session.stationChoice}
    <TitlePanel label="Foreign investor's station">
        {@render joining(investorId, companyId)}
        <p>
            {session.actionCompanyName(investorId)} has joined {session.actionCompanyName(
                companyId
            )}’s network and leaves the map. Replace its token with {session.actionCompanyName(
                companyId
            )}’s?
        </p>
        <div class="choices">
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.replaceInvestorStation(true)}>Replace</button
            >
            <button
                class="action-button"
                disabled={session.busy}
                onclick={() => session.replaceInvestorStation(false)}>No token</button
            >
        </div>
    </TitlePanel>
{/if}

<style>
    .joining {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 4px;
    }
    .joining :global(svg) {
        display: block;
    }
    .arrow {
        width: 24px;
        height: 12px;
        fill: none;
        stroke: var(--rail-muted, #817261);
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .replace-switch {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px 4px 6px;
        border: 0;
        border-radius: 999px;
        background: var(--rail-surface, #222c37);
        color: var(--rail-muted, #7f8e9e);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .replace-switch:hover:not(:disabled),
    .replace-switch[aria-checked='true'] {
        color: var(--rail-text, #e3e9ef);
    }
    .replace-switch:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 1px;
    }
    .replace-switch:disabled {
        cursor: default;
        opacity: 0.6;
    }
</style>
