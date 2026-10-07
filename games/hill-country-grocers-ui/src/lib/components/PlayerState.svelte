<script lang="ts">
    import { COMPANIES, type HydratedHcgPlayerState } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { SPACE_NAMES } from '$lib/utils/describeAction.js'

    let { playerState }: { playerState: HydratedHcgPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const holdings = $derived(
        COMPANIES.map((company) => ({
            company,
            style: COMPANY_STYLE[company.id],
            shares: gameSession.gameState.sharesHeld(company.id, playerId),
            perShare: gameSession.gameState.perShare(company.id)
        })).filter((holding) => holding.shares > 0)
    )
    const dividend = $derived(gameSession.gameState.projectedDividend(playerId))
</script>

<div class="receipt" class:acting style:--player={color} style:--player-text={textColor}>
    <div class="banner">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="cash" title="Personal money">${playerState.cash}</span>
    </div>
    <div class="lines">
        {#each holdings as holding (holding.company.id)}
            <div class="line">
                <span class="swatch" style:background={holding.style.fill}></span>
                <span class="item">{holding.company.shortName} ×{holding.shares}</span>
                <span class="dots"></span>
                <span class="price" title="Dividend per share if paid now">@ ${holding.perShare}</span>
            </div>
        {:else}
            <div class="none">No shares yet</div>
        {/each}
    </div>
    <div class="total" title="What this player's shares would pay if dividends were paid now">
        <span>Next dividend</span>
        <strong>${dividend}</strong>
    </div>
    {#if playerState.actionSpace}
        <div class="last">Last action · {SPACE_NAMES[playerState.actionSpace]}</div>
    {/if}
</div>

<style>
    .receipt {
        position: relative;
        border-radius: 4px;
        background: #fffdf6;
        box-shadow:
            0 0 0 1px #d9c7a4,
            0 2px 6px rgba(58, 26, 16, 0.15);
        padding: 0 0 6px;
        color: #3a1a10;
        font-family: 'Libre Baskerville', Georgia, serif;
        mask: radial-gradient(circle 5px at 50% 100%, transparent 98%, #000) 0 0 / 14px 100%
            repeat-x;
    }

    .receipt.acting {
        box-shadow:
            0 0 0 3px var(--player),
            0 2px 8px rgba(58, 26, 16, 0.25);
    }

    .banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border-radius: 4px 4px 0 0;
        padding: 4px 10px;
        background: var(--player);
        color: var(--player-text);
        box-shadow: inset 0 0 0 1.5px rgba(29, 20, 11, 0.35);
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .cash {
        font-size: 22px;
        font-weight: 700;
    }

    .lines {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 10px 2px;
        font-family: 'Courier New', monospace;
        font-size: 15px;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
    }

    .dots {
        flex: 1;
        border-bottom: 1px dotted #b59a72;
        transform: translateY(-3px);
    }

    .none {
        font-style: italic;
        font-size: 14px;
        color: #9a6a45;
    }

    .total {
        display: flex;
        justify-content: space-between;
        margin: 4px 10px 0;
        border-top: 1px dashed #b59a72;
        padding-top: 3px;
        font-family: 'Courier New', monospace;
        font-size: 15px;
    }

    .last {
        padding: 2px 10px 4px;
        font-size: 13px;
        font-style: italic;
        color: #7a4a2e;
    }
</style>
