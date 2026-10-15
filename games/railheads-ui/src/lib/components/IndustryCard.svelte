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
                    <span class="stacked" style:left="{OFFSET_X * step}px" style:top="{OFFSET_Y * step}px">
                        <IndustryToken {industry} size={TOKEN_SIZE} />
                    </span>
                {/each}
            </span>
        {:else}
            <span
                class="empty-slot"
                style:width="{TOKEN_SIZE}px"
                style:height="{TOKEN_SIZE}px"
            ></span>
        {/if}
        <span class="count">{count} {label}</span>
    </div>
{/snippet}

<div class="card" style:--ring={style.ring}>
    <div class="head">
        <span class="name">{style.name}</span>
        <span class="level" title="Development level, out of {length}">Level {level}</span>
    </div>
    <div class="body">
        {@render pile(forSale, 'for sale', `${forSale} tokens still to be auctioned`)}
        <div class="figures">
            <div
                class="entry"
                title="Each {style.name} token pays {gameSession.money(level)} at the payout, equal to its development level"
            >
                <span>Payout</span><span class="money">{gameSession.money(level)}</span>
            </div>
            <div class="entry" title="Industry sites with a company disc on them, of all {sites}">
                <span>Sites</span><span class="money">{reached}/{sites}</span>
            </div>
        </div>
    </div>
    <div class="track" role="img" aria-label="Level {level} of {length}">
        <span class="fill" style:width="{(100 * level) / length}%"></span>
    </div>
</div>

<style>
    .card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 2px solid var(--ring);
        border-radius: 8px;
        background: #f6f2da;
        color: #26300f;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 12.5px;
        box-shadow: 0 1px 3px rgba(30, 36, 10, 0.2);
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 8px;
        background: var(--ring);
        color: #ffffff;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
    }

    .name {
        font-size: 16px;
    }

    .level {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 13px;
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
        width: 66px;
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

    .money {
        display: flex;
        align-items: center;
        align-self: stretch;
        justify-content: flex-end;
        min-width: 58px;
        padding: 0 8px;
        border-left: 1px solid #c9c493;
        font-size: 16px;
        font-weight: 700;
    }

    .entry:first-child .money {
        font-size: 22px;
        color: #a3311d;
    }

    .track {
        height: 6px;
        border-top: 1px solid #c9c493;
        background: #d9d4a8;
    }

    .fill {
        display: block;
        height: 100%;
        background: var(--ring);
    }
</style>
