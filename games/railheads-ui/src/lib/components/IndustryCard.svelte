<script lang="ts">
    import type { Industry } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryToken from './IndustryToken.svelte'

    let { industry }: { industry: Industry } = $props()

    const gameSession = getGameSession()

    const state = $derived(gameSession.shownState)
    const style = $derived(INDUSTRY_STYLE[industry])
    const level = $derived(state.industry(industry).level)
    const length = $derived(state.edition.definition.developmentTrackLength)
    const reached = $derived(state.industrySitesReached(industry))
    const sites = $derived(state.edition.industrySiteCount(industry))
</script>

<div class="card" style:--ring={style.ring}>
    <div class="band">
        <IndustryToken {industry} size={40} />
        <span class="name">{style.name}</span>
        <span class="pays" title="Each token pays this at the payout (the development level)">
            <span class="figure">${level}</span><span class="unit">per token</span>
        </span>
    </div>
    <div class="track" role="img" aria-label="Level {level} of {length}">
        <span class="fill" style:width="{(100 * level) / length}%"></span>
    </div>
    <div class="entry" title="Tokens still to be auctioned">
        <span>For sale</span><span class="money">{state.industry(industry).available}</span>
    </div>
    <div class="entry" title="Tokens held by investors">
        <span>Held</span><span class="money">{state.tokensHeld(industry)}</span>
    </div>
    <div class="entry" title="Industry sites with a company disc on them: reached of total">
        <span>Reached</span><span class="money">{reached}/{sites}</span>
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

    .band {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: #ece6b8;
        border-bottom: 2px solid var(--ring);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
    }

    .name {
        flex: 1;
        font-size: 14px;
    }

    .pays {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1;
    }

    .figure {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 24px;
        color: #a3311d;
    }

    .unit {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 10px;
        font-weight: 400;
    }

    .track {
        height: 8px;
        margin: 5px 8px;
        border: 1px solid #8f8a5c;
        border-radius: 4px;
        background: #d9d4a8;
        overflow: hidden;
    }

    .fill {
        display: block;
        height: 100%;
        background: var(--ring);
    }

    .entry {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1px 8px;
        white-space: nowrap;
        border-top: 1px solid #e3dfb8;
    }

    .money {
        font-size: 14px;
        font-weight: 700;
    }
</style>
