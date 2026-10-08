<script lang="ts">
    import {
        CompanyKind,
        companyDefinition,
        type CompanyId
    } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import ShareCertificate from './ShareCertificate.svelte'
    import Development from './icons/Development.svelte'
    import Store from './icons/Store.svelte'

    let {
        companyId,
        choice,
        selected
    }: { companyId: CompanyId; choice?: 'build' | 'auction'; selected: boolean } = $props()

    const gameSession = getGameSession()

    // Up to this many pieces are drawn one by one; more show as a count.
    const DRAWN_SUPPLY = 4

    const definition = $derived(companyDefinition(companyId))
    const style = $derived(COMPANY_STYLE[companyId])
    const company = $derived(gameSession.gameState.company(companyId))
    const totalShares = $derived(gameSession.gameState.sharesPerCompany())
    const sold = $derived(company.owners.length)
    const supply = $derived(gameSession.gameState.supplyRemaining(companyId))
    const grocer = $derived(definition.kind === CompanyKind.Grocer)

    function choose() {
        if (choice === 'build') {
            gameSession.selectBuildCompany(companyId)
        } else if (choice === 'auction') {
            gameSession.selectAuctionCompany(companyId)
        }
    }
</script>

{#snippet piece()}
    <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
        {#if grocer}
            <Store x={0} y={0} size={14} fill={style.fill} tint={style.tint} />
        {:else}
            <Development x={0} y={0} size={15} />
        {/if}
    </svg>
{/snippet}

{#snippet body()}
    <div class="head" style:color={style.text}>{definition.name}</div>
    <div class="entry">
        <span>Treasury</span><span class="money">${company.treasury}</span>
    </div>
    <div class="entry">
        <span>Company value</span><span class="money"
            >${gameSession.gameState.value(companyId)}</span
        >
    </div>
    <div class="entry">
        <span>Dividend per share</span><span class="money"
            >${gameSession.gameState.perShare(companyId)}</span
        >
    </div>
    <div class="entry holdings">
        <span class="shares" title="{sold} of {totalShares} shares sold">
            {#each Array.from({ length: totalShares }, (_, index) => index) as share (share)}
                <ShareCertificate {companyId} sold={share < sold} />
            {/each}
        </span>
        <span class="money supply" title="{supply} {grocer ? 'stores' : 'developments'} left">
            {#if supply === 0}
                <span class="none">none</span>
            {:else if supply <= DRAWN_SUPPLY}
                {#each Array.from({ length: supply }, (_, index) => index) as item (item)}
                    {@render piece()}
                {/each}
            {:else}
                {@render piece()}×{supply}
            {/if}
        </span>
    </div>
    <div class="ability">{definition.ability}</div>
{/snippet}

{#if choice}
    <div
        class="card choosable"
        class:selected
        style:--company={style.fill}
        role="button"
        tabindex="0"
        aria-label={choice === 'build'
            ? `Build for ${definition.name}`
            : `Auction a ${definition.name} share`}
        onclick={choose}
        onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                choose()
            }
        }}
    >
        {@render body()}
    </div>
{:else}
    <div class="card" class:selected style:--company={style.fill}>
        {@render body()}
    </div>
{/if}

<style>
    .card {
        overflow: hidden;
        border: 1px solid #9bbf9e;
        border-radius: 2px;
        background: #f4f8ee;
        color: #2b1a10;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 12.5px;
        box-shadow: 0 1px 2px rgba(43, 26, 16, 0.2);
    }

    .card.selected {
        border-color: #c8961a;
        box-shadow: 0 0 0 2px #c8961a;
    }

    .card.choosable {
        cursor: pointer;
        border: 2px dashed #c8961a;
        outline: none;
    }

    .card.choosable:hover,
    .card.choosable:focus-visible {
        box-shadow: 0 0 0 2px #c8961a;
    }

    .head {
        padding: 2px 8px;
        background: var(--company);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .entry {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 19px;
        padding-left: 8px;
        border-bottom: 1px solid #c9dcc8;
    }

    .money {
        display: flex;
        align-self: stretch;
        align-items: center;
        justify-content: flex-end;
        gap: 1px;
        min-width: 58px;
        padding: 0 8px;
        border-left: 1px solid #e3a0a0;
        font-weight: 700;
    }

    .holdings {
        height: 27px;
    }

    .shares {
        display: flex;
        gap: 3px;
    }

    .none {
        font-weight: 400;
        font-style: italic;
        color: #9a6a45;
    }

    .ability {
        padding: 2px 8px 3px;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
        color: #5a3a28;
    }
</style>
