<script lang="ts">
    import type { CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { editionStyle } from '$lib/utils/editionStyle.js'
    import ShareCertificate, {
        CERTIFICATE_HEIGHT,
        CERTIFICATE_WIDTH
    } from './ShareCertificate.svelte'
    import Stamp from './Stamp.svelte'

    let {
        companyId,
        choose,
        selected
    }: { companyId: CompanyId; choose?: () => void; selected: boolean } = $props()

    const gameSession = getGameSession()

    const SHARE_OFFSET_X = 4
    const SHARE_OFFSET_Y = 8

    const state = $derived(gameSession.shownState)
    const definition = $derived(state.companyDefinition(companyId))
    const style = $derived(COMPANY_STYLE[companyId])
    const company = $derived(state.company(companyId))
    const sharesLeft = $derived(state.unsoldShares(companyId))
    const stackSteps = $derived(definition.shares - 1)
    const drop = $derived(state.edition.obsolescenceDrop(company.revenue))
    const bonus = $derived(editionStyle(state.editionId))
    const countsRegions = $derived(state.edition.map.regions.length > 0)
</script>

{#snippet body()}
    <div
        class="head"
        style:background={style.fill}
        style:color={style.text}
        title={definition.name}
    >
        <span class="acronym">{definition.shortName}</span>
        <span class="treasury" title="Treasury: pays for track">
            <span class="treasury-label">Treasury</span>
            <span class="treasury-amount">${company.treasury}</span>
        </span>
    </div>
    <div class="body">
        <div class="pile" title="{sharesLeft} of {definition.shares} shares left on the charter">
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
                            <ShareCertificate {companyId} labelled={step === stackSteps} />
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
        <div class="figures">
            <div
                class="entry"
                title="Revenue Level{drop > 0 ? `; falls ${drop} at the end of the round` : ''}"
            >
                <span>Revenue</span><span class="money"
                    >${company.revenue}{#if drop > 0}<span class="drop">−{drop}</span>{/if}</span
                >
            </div>
            <div class="entry" title="Payout per share: revenue ÷ shares sold, rounded up">
                <span>Per share</span><span class="money">${state.dividendPerShare(companyId)}</span
                >
            </div>
            <div
                class="entry"
                title="Game-end {bonus.endBonusName} if the game ended now: {bonus.endBonusRule}"
            >
                {#if countsRegions}
                    <span>States · end / share</span><span class="money"
                        >{state.regionsReached(companyId)} · ${state.endBonusPerShare(
                            companyId
                        )}</span
                    >
                {:else}
                    <span>End bonus / share</span><span class="money"
                        >${state.endBonusPerShare(companyId)}</span
                    >
                {/if}
            </div>
            <div class="entry" title="Track discs and crossing cubes still on the charter">
                <span>Discs · cubes</span><span class="money"
                    >{state.discsLeft(companyId)} · {state.cubesLeft(companyId)}</span
                >
            </div>
        </div>
    </div>
{/snippet}

{#if choose}
    <div
        class="charter choosable"
        class:selected
        role="button"
        tabindex="0"
        aria-label="Choose the {definition.shortName}"
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
    <div class="charter" class:selected>
        {@render body()}
    </div>
{/if}

<style>
    .charter {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 2px solid #4a5a24;
        border-radius: 8px;
        background: #f6f2da;
        color: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 12.5px;
        box-shadow: 0 1px 3px rgba(30, 36, 10, 0.2);
    }

    .charter.selected {
        border-color: #9a7d12;
        box-shadow: 0 0 0 2px #d8b62a;
    }

    .charter.choosable {
        cursor: pointer;
        border: 2px dashed #9a7d12;
        background: #fbf3c4;
        outline: none;
    }

    .charter.choosable:hover,
    .charter.choosable:focus-visible {
        background: #f7e897;
        box-shadow: 0 0 0 2px #d8b62a;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 8px;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-weight: 700;
    }

    .acronym {
        font-size: 16px;
        letter-spacing: 0.02em;
    }

    .treasury {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-family: 'Railheads Baskerville', Georgia, serif;
    }

    .treasury-label {
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.9;
    }

    .treasury-amount {
        font-size: 16px;
    }

    .body {
        display: flex;
        align-items: stretch;
    }

    .pile {
        position: relative;
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 74px;
        padding: 6px 0 4px;
        border-right: 1px solid #d9d4a8;
        background: #ece7c6;
        --stamp-size: 9px;
    }

    .stack {
        position: relative;
    }

    .stacked {
        position: absolute;
        display: flex;
        border-radius: 2px;
        box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
    }

    .sold-out {
        display: flex;
        flex: 1;
        align-items: center;
        align-self: stretch;
        justify-content: center;
    }

    .empty-slot {
        box-sizing: border-box;
        border: 1.5px dashed #b9b48a;
        border-radius: 2px;
    }

    .count {
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
    }

    .figures {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
    }

    .entry {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        padding-left: 8px;
        border-bottom: 1px solid #e3dfb8;
    }

    .entry:last-child {
        border-bottom: 0;
    }

    .entry:nth-child(even) {
        background: #ece7c6;
    }

    .money {
        display: flex;
        align-items: center;
        align-self: stretch;
        justify-content: flex-end;
        gap: 3px;
        min-width: 58px;
        padding: 0 8px;
        border-left: 1px solid #c9c493;
        font-size: 14px;
        font-weight: 700;
    }

    .drop {
        font-size: 10px;
        color: #a3311d;
    }
</style>
