<script lang="ts">
    import type { Industry } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryToken from './IndustryToken.svelte'

    let { industry }: { industry: Industry } = $props()

    const gameSession = getGameSession()

    const TOKEN_SIZE = 30
    const OFFSET_X = 4
    const OFFSET_Y = 6

    const state = $derived(gameSession.shownState)
    const style = $derived(INDUSTRY_STYLE[industry])
    const level = $derived(state.industry(industry).level)
    const length = $derived(state.edition.definition.developmentTrackLength)
    const forSale = $derived(state.industry(industry).available)
    const steps = $derived(Math.max(0, state.edition.definition.industryTokensPerType - 1))
    const reached = $derived(state.industrySitesReached(industry))
    const sites = $derived(state.edition.industrySiteCount(industry))
    const perSite = $derived(state.edition.definition.industryBonusPerSite)
</script>

{#snippet pile(count: number, label: string, title: string)}
    <div class="pile" {title}>
        {#if count > 0}
            <span
                class="stack"
                style:width="{TOKEN_SIZE + OFFSET_X * steps}px"
                style:height="{TOKEN_SIZE + OFFSET_Y * steps}px"
            >
                {#each Array.from({ length: count }, (_, index) => index) as step (step)}
                    <span
                        class="stacked"
                        style:left="{OFFSET_X * step}px"
                        style:top="{OFFSET_Y * step}px"
                    >
                        <IndustryToken {industry} size={TOKEN_SIZE} />
                    </span>
                {/each}
            </span>
        {:else}
            <span class="empty-slot" style:width="{TOKEN_SIZE}px" style:height="{TOKEN_SIZE}px"
            ></span>
        {/if}
        <span class="count">{count} {label}</span>
    </div>
{/snippet}

<div class="card">
    <div class="head" style:background={style.ring} style:color={style.text}>
        <span class="name">{style.name}</span>
        <span class="level" title="Development level, out of {length}">
            <span class="level-label">Level</span>
            <span class="level-amount">{level}</span>
        </span>
    </div>
    <div class="body">
        {@render pile(forSale, 'left', `${forSale} tokens left to be auctioned`)}
        <div class="figures">
            <div
                class="entry"
                title="Each {style.name} token pays ${level} at the payout, equal to its development level"
            >
                <span>Payout per token</span><span class="money">${level}</span>
            </div>
            <div class="entry" title="Industry sites with a company disc on them, of all {sites}">
                <span>Sites reached</span><span class="money">{reached}/{sites}</span>
            </div>
            <div
                class="entry"
                title="Game-end Industry Bonus if the game ended now: ${perSite} for each {style.name} site with a disc on it, shared among the tokens held, rounded up"
            >
                <span>End bonus / token</span><span class="money"
                    >${state.industryBonusPerToken(industry)}</span
                >
            </div>
        </div>
    </div>
    <div class="track" role="img" aria-label="Level {level} of {length}">
        <span class="fill" style:width="{(100 * level) / length}%" style:background={style.ring}
        ></span>
    </div>
</div>

<style>
    .card {
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

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 8px;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-weight: 700;
    }

    .name {
        font-size: 16px;
        letter-spacing: 0.02em;
    }

    .level {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-family: 'Railheads Baskerville', Georgia, serif;
    }

    .level-label {
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.9;
    }

    .level-amount {
        font-size: 16px;
    }

    .body {
        display: flex;
        align-items: stretch;
    }

    .pile {
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 3px;
        width: 74px;
        padding: 6px 0 4px;
        border-right: 1px solid #d9d4a8;
        background: #ece7c6;
    }

    .stack {
        position: relative;
    }

    .stacked {
        position: absolute;
        display: flex;
    }

    .empty-slot {
        box-sizing: border-box;
        border: 1.5px dashed #b9b48a;
        border-radius: 3px;
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
        box-sizing: border-box;
        flex: none;
        width: 68px;
        padding: 0 8px;
        border-left: 1px solid #c9c493;
        font-size: 14px;
        font-weight: 700;
    }

    .track {
        height: 5px;
        border-top: 1px solid #d9d4a8;
        background: #e3dfb8;
    }

    .fill {
        display: block;
        height: 100%;
    }
</style>
