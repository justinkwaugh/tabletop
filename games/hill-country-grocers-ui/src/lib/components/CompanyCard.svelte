<script lang="ts">
    import { CompanyKind, companyDefinition, type CompanyId } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import ShareCertificate, {
        CERTIFICATE_HEIGHT,
        CERTIFICATE_WIDTH
    } from './ShareCertificate.svelte'
    import Stamp from './Stamp.svelte'
    import Development from './icons/Development.svelte'
    import Store from './icons/Store.svelte'

    let {
        companyId,
        choice,
        selected
    }: { companyId: CompanyId; choice?: 'build' | 'auction'; selected: boolean } = $props()

    const gameSession = getGameSession()

    const SHARE_OFFSET_X = 4
    const SHARE_OFFSET_Y = 3

    const definition = $derived(companyDefinition(companyId))
    const style = $derived(COMPANY_STYLE[companyId])
    const company = $derived(gameSession.gameState.company(companyId))
    const totalShares = $derived(gameSession.gameState.sharesPerCompany())
    const sharesLeft = $derived(gameSession.gameState.unsoldShares(companyId))
    const supply = $derived(gameSession.gameState.supplyRemaining(companyId))
    const grocer = $derived(definition.kind === CompanyKind.Grocer)
    const stackSteps = $derived(totalShares - 1)

    function choose() {
        if (choice === 'build') {
            gameSession.selectBuildCompany(companyId)
        } else if (choice === 'auction') {
            gameSession.selectAuctionCompany(companyId)
        }
    }
</script>

{#snippet body()}
    <div class="head" style:color={style.text}>
        <span>{definition.name}</span>
        <span class="treasury">
            <span class="treasury-label">Treasury</span>
            <span class="money">${company.treasury}</span>
        </span>
    </div>
    <div class="ledger">
        <div class="pile shares" title="{sharesLeft} of {totalShares} shares left for auction">
            {#if sharesLeft > 0}
                <span
                    class="stack"
                    style:width="{CERTIFICATE_WIDTH + SHARE_OFFSET_X * stackSteps}px"
                    style:height="{CERTIFICATE_HEIGHT + SHARE_OFFSET_Y * stackSteps}px"
                >
                    {#each Array.from({ length: sharesLeft }, (_, index) => stackSteps - sharesLeft + 1 + index) as step (step)}
                        <span
                            class="stacked"
                            aria-hidden="true"
                            style:left="{SHARE_OFFSET_X * step}px"
                            style:top="{SHARE_OFFSET_Y * step}px"
                        >
                            <ShareCertificate {companyId} />
                        </span>
                    {/each}
                </span>
                <span class="count">{sharesLeft} left</span>
            {:else}
                <span class="sold-out">
                    <span
                        class="empty-slot"
                        style:width="{CERTIFICATE_WIDTH}px"
                        style:height="{CERTIFICATE_HEIGHT}px"
                    ></span>
                    <Stamp label="All sold" />
                </span>
            {/if}
        </div>
        <div class="pile supply" title="{supply} {grocer ? 'stores' : 'developments'} left">
            <svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true">
                {#if grocer}
                    <Store
                        x={0}
                        y={0}
                        size={20}
                        fill={style.fill}
                        tint={style.tint}
                        ghost={supply === 0}
                    />
                {:else}
                    <Development x={0} y={0} size={22} built={supply > 0} />
                {/if}
            </svg>
            <span class="count" class:none={supply === 0}
                >{supply === 0 ? 'none' : `${supply} left`}</span
            >
        </div>
        <div class="rows">
            <div class="entry" title="Company value">
                <span>Value</span><span class="money"
                    >${gameSession.gameState.value(companyId)}</span
                >
            </div>
            <div class="entry" title="Dividend per share">
                <span>Dividend</span><span class="money"
                    >${gameSession.gameState.perShare(companyId)}</span
                >
            </div>
        </div>
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
        font-size: 14px;
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-left: 8px;
        background: var(--company);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .treasury {
        display: flex;
        align-items: center;
        align-self: stretch;
        gap: 6px;
        min-height: 22px;
        font-family: 'Courier Prime', 'Courier New', monospace;
    }

    .treasury .money {
        border-left-color: rgba(255, 255, 255, 0.45);
    }

    .treasury-label {
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.85;
    }

    .ledger {
        display: flex;
        border-bottom: 1px solid #c9dcc8;
    }

    .pile {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        padding: 5px 0 3px;
        border-right: 1px solid #c9dcc8;
        background: #fbf3e6;
    }

    .pile.shares {
        width: 72px;
        --stamp-size: 9px;
    }

    .pile.supply {
        width: 50px;
    }

    .stack {
        position: relative;
    }

    .stacked {
        position: absolute;
        display: flex;
        border-radius: 3px;
        box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
    }

    .sold-out {
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        flex: 1;
    }

    .empty-slot {
        box-sizing: border-box;
        border: 1.5px dashed #c4b496;
        border-radius: 3px;
    }

    .count {
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
    }

    .rows {
        display: flex;
        flex: 1;
        flex-direction: column;
    }

    .entry {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        padding-left: 8px;
        border-bottom: 1px solid #c9dcc8;
    }

    .entry:last-child {
        border-bottom: 0;
    }

    .money {
        display: flex;
        align-self: stretch;
        align-items: center;
        justify-content: flex-end;
        min-width: 58px;
        padding: 0 8px;
        border-left: 1px solid #e3a0a0;
        font-size: 16px;
        font-weight: 700;
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
