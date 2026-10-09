<script lang="ts">
    import { COMPANIES, type HydratedHcgPlayerState } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShareCertificate from './ShareCertificate.svelte'

    let { playerState }: { playerState: HydratedHcgPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const lines = $derived(
        COMPANIES.map((company) => {
            const shares = gameSession.gameState.sharesHeld(company.id, playerId)
            const each = gameSession.gameState.perShare(company.id)
            return { companyId: company.id, shares, each, amount: shares * each }
        }).filter((line) => line.shares > 0)
    )
    const dividend = $derived(gameSession.gameState.projectedDividend(playerId))
</script>

<div class="slip" class:acting>
    <div class="receipt" style:--player={color}>
        <div class="header">
            <span class="name">{gameSession.getPlayerName(playerId)}</span
            >
            <span class="cash" title="Personal money">CASH ${playerState.cash}</span>
        </div>
        <div class="double-rule"></div>
        {#each lines as line (line.companyId)}
            <div class="line" title="Dividend per share if paid now: ${line.each}">
                <span class="shares">
                    {#each Array.from({ length: line.shares }, (_, index) => index) as share (share)}
                        <ShareCertificate companyId={line.companyId} />
                    {/each}
                </span>
                <span class="leader"></span>
                <span class="amount">${line.amount}</span>
            </div>
        {:else}
            <div class="none">No shares yet</div>
        {/each}
        <div class="tear"></div>
        <div
            class="total"
            title="What this player's shares would pay if dividends were paid now"
        >
            <span>TOTAL DIV <strong>${dividend}</strong></span>
        </div>
    </div>
</div>

<style>
    .slip {
        border-radius: 5px;
    }

    .slip.acting {
        padding: 3px;
        background: #7a1d22;
        box-shadow: 0 2px 8px rgba(122, 29, 34, 0.45);
    }

    .receipt {
        position: relative;
        padding: 3px 10px 6px 26px;
        background: #fffdf6;
        color: #2b1a10;
        font-family: 'Courier Prime', 'Courier New', monospace;
        filter: drop-shadow(0 1px 1.5px rgba(43, 26, 16, 0.25));
        mask:
            linear-gradient(#000 0 0) top / 100% calc(100% - 3px) no-repeat,
            radial-gradient(circle 3.5px at 50% 0, #000 95%, #0000) 50% 100% / 8px 3px repeat-x;
    }

    /* The coloured stripe a till roll carries near its end. */
    .receipt::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 16px;
        background: var(--player);
        box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.2);
    }

    .header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }


    .cash {
        flex: none;
        font-size: 16px;
    }

    .double-rule {
        margin: 2px 0 2px;
        border-top: 3px double #2b1a10;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 5px;
        height: 25px;
    }

    .shares {
        display: flex;
        flex: none;
        gap: 2px;
    }

    .leader {
        flex: 1;
        min-width: 8px;
        border-bottom: 1.5px dotted #c9b48a;
        transform: translateY(4px);
    }


    .amount {
        min-width: 30px;
        font-size: 16px;
        text-align: right;
    }

    .none {
        padding: 2px 0;
        font-size: 13px;
        font-style: italic;
        color: #9a6a45;
    }

    .tear {
        margin-top: 2px;
        border-top: 1.5px dashed #b59a68;
    }

    .total {
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        margin-top: 1px;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
    }

    .total strong {
        letter-spacing: 0;
    }

</style>
