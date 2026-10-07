<script lang="ts">
    import { COMPANIES, type HydratedHcgPlayerState } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    let { playerState }: { playerState: HydratedHcgPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const holdings = $derived(
        COMPANIES.map((company) => {
            const shares = gameSession.gameState.sharesHeld(company.id, playerId)
            const perShare = gameSession.gameState.perShare(company.id)
            return {
                company,
                style: COMPANY_STYLE[company.id],
                shares,
                perShare,
                total: shares * perShare
            }
        }).filter((holding) => holding.shares > 0)
    )
    const dividend = $derived(gameSession.gameState.projectedDividend(playerId))
</script>

<div class="receipt" class:acting style:--player={color} style:--player-text={textColor}>
    <div class="banner">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
    </div>
    <div class="row cash" title="Personal money">
        <span>Cash on hand</span>
        <span>${playerState.cash}</span>
    </div>
    <div class="rule"></div>
    {#if holdings.length > 0}
        <div class="items">
            <span class="head">Qty</span>
            <span class="head">Item</span>
            <span class="head right">Each</span>
            <span class="head right">Amt</span>
            {#each holdings as holding (holding.company.id)}
                <span class="qty">{holding.shares}</span>
                <span class="item"
                    ><span class="swatch" style:background={holding.style.fill}></span
                    >{holding.company.shortName}</span
                >
                <span class="right" title="Dividend per share if paid now">@&nbsp;${holding.perShare}</span>
                <span class="right">${holding.total}</span>
            {/each}
        </div>
    {:else}
        <div class="none">No shares yet</div>
    {/if}
    <div class="rule"></div>
    <div class="row total" title="What this player's shares would pay if dividends were paid now">
        <span>Next dividend</span>
        <span>${dividend}</span>
    </div>
</div>

<style>
    .receipt {
        --edge: 3.5px;
        position: relative;
        padding: 10px 12px 14px;
        background:
            linear-gradient(180deg, rgba(0, 0, 0, 0.03), transparent 30%),
            #fffdf7;
        color: #2b2620;
        font-family: 'Courier New', Courier, monospace;
        filter: drop-shadow(0 2px 3px rgba(58, 26, 16, 0.22));
        mask:
            conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% /
                calc(var(--edge) * 2) 100%,
            conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) 50% /
                calc(var(--edge) * 2) 100%;
        mask-composite: intersect;
    }

    .receipt.acting {
        background:
            linear-gradient(180deg, rgba(0, 0, 0, 0.03), transparent 30%),
            #fff8d8;
    }


    .banner {
        margin: 5px -4px 6px;
        border-radius: 2px;
        padding: 3px 8px;
        background: var(--player);
        color: var(--player-text);
        box-shadow: inset 0 0 0 1.5px rgba(29, 20, 11, 0.35);
        text-align: center;
    }

    .name {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .row {
        display: flex;
        justify-content: space-between;
        font-size: 15px;
        text-transform: uppercase;
    }

    .row.cash {
        font-size: 17px;
        font-weight: 700;
    }

    .row.total {
        font-weight: 700;
    }

    .rule {
        margin: 5px 0;
        border-top: 1.5px dashed #9c8e78;
    }

    .items {
        display: grid;
        grid-template-columns: 3ch 1fr 6ch 5ch;
        column-gap: 1ch;
        row-gap: 1px;
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        text-transform: uppercase;
    }

    .head {
        font-size: 11px;
        letter-spacing: 0.08em;
        color: #7d7262;
    }

    .qty {
        text-align: right;
    }

    .right {
        text-align: right;
        white-space: nowrap;
    }

    .item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        overflow: hidden;
        white-space: nowrap;
    }

    .swatch {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 2px;
    }

    .none {
        font-size: 14px;
        font-style: italic;
        color: #7d7262;
    }

</style>
