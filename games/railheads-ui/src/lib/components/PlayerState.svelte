<script lang="ts">
    import { INDUSTRIES, type HydratedRailheadsPlayerState } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import IndustryToken from './IndustryToken.svelte'
    import ShareCertificate from './ShareCertificate.svelte'
    import TrainIcon from './TrainIcon.svelte'

    let { playerState }: { playerState: HydratedRailheadsPlayerState } = $props()

    const gameSession = getGameSession()

    const state = $derived(gameSession.shownState)
    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const shares = $derived(
        state.companies
            .map((company) => {
                const count = state.sharesHeld(company.id, playerId)
                const each = state.dividendPerShare(company.id)
                return { companyId: company.id, count, each, amount: count * each }
            })
            .filter((line) => line.count > 0)
    )
    const tokens = $derived(
        INDUSTRIES.map((industry) => {
            const count = playerState.tokensOf(industry)
            const each = state.industry(industry).level
            return { industry, count, each, amount: count * each }
        }).filter((line) => line.count > 0)
    )
    const payout = $derived(state.playerIncome(playerId, state.roundPayouts()))
    const startPlayer = $derived(state.startPlayerId === playerId)
</script>

<div class="depot" class:acting style:--player={color}>
    <div class="band">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        {#if startPlayer}
            <span class="start" title="Holds the Start Player token"><TrainIcon /></span>
        {/if}
        <span class="cash" title="Cash in hand">${playerState.cash}</span>
    </div>
    {#each shares as line (line.companyId)}
        <div class="line" title="${line.each} a share at the next payout">
            <span class="items">
                {#each Array.from({ length: line.count }, (_, index) => index) as share (share)}
                    <ShareCertificate companyId={line.companyId} />
                {/each}
            </span>
            <span class="leader"></span>
            <span class="amount">${line.amount}</span>
        </div>
    {/each}
    {#each tokens as line (line.industry)}
        <div class="line" title="${line.each} a token at the next payout">
            <span class="items">
                {#each Array.from({ length: line.count }, (_, index) => index) as token (token)}
                    <IndustryToken industry={line.industry} size={30} />
                {/each}
            </span>
            <span class="leader"></span>
            <span class="amount">${line.amount}</span>
        </div>
    {/each}
    {#if shares.length === 0 && tokens.length === 0}
        <div class="none">No shares or tokens yet</div>
    {/if}
    <div class="total" title="What this player's shares and tokens would pay if the round ended now">
        <span>PAYOUT DUE</span>
        <span>${payout}</span>
    </div>
</div>

<style>
    .depot {
        position: relative;
        overflow: hidden;
        border: 1px solid #8f8a5c;
        border-radius: 4px;
        background: #f6f2da;
        color: #26300f;
        font-family: 'Courier Prime', 'Courier New', monospace;
        box-shadow:
            inset 0 0 0 3px #f6f2da,
            inset 0 0 0 4px #b9b48a,
            0 1px 3px rgba(30, 36, 10, 0.25);
    }

    .depot.acting {
        border-color: var(--player);
        box-shadow:
            inset 0 0 0 3px #f6f2da,
            inset 0 0 0 4px var(--player),
            0 2px 6px rgba(30, 36, 10, 0.4);
    }

    .band {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px 4px 12px;
        border-left: 10px solid var(--player);
        border-bottom: 1px solid #b9b48a;
        background: linear-gradient(90deg, color-mix(in srgb, var(--player) 22%, #f6f2da), #f6f2da);
    }

    .name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
        font-variant: small-caps;
    }

    .start {
        display: inline-flex;
    }

    .cash {
        font-size: 16px;
        font-weight: 700;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px 3px 12px;
        font-size: 13px;
    }

    .items {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px;
    }

    .leader {
        flex: 1;
        height: 8px;
        border-bottom: 1px dotted #7c7a52;
    }

    .amount {
        font-size: 18px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .none {
        padding: 4px 12px;
        font-size: 12px;
        font-style: italic;
        color: #6d6a45;
    }

    .total {
        display: flex;
        justify-content: space-between;
        margin: 2px 6px 5px;
        padding: 3px 6px 2px;
        border-top: 1px solid #b9b48a;
        font-size: 14px;
        font-weight: 700;
    }
</style>
