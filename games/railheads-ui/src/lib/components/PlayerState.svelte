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
    const endBonuses = $derived.by(() => {
        if (!state.isFinalRound()) {
            return []
        }
        const { companies, industries } = state.finalPayouts()
        return [
            {
                label: 'Game End Railroad',
                title: 'Game-end Railroad Bonus on your shares, if the game ended now',
                amount: state.playerIncome(playerId, { companies, industries: [] })
            },
            {
                label: 'Game End Industry',
                title: 'Game-end Industry Bonus on your tokens, if the game ended now',
                amount: state.playerIncome(playerId, { companies: [], industries })
            }
        ]
    })
    const payout = $derived(
        state.playerIncome(playerId, state.roundPayouts()) +
            endBonuses.reduce((sum, bonus) => sum + bonus.amount, 0)
    )
    const startPlayer = $derived(state.startPlayerId === playerId)
</script>

<div class="depot" class:acting style:--player={color}>
    <div class="band">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        {#if startPlayer}
            <span class="start" title="Holds the Start Player token"><TrainIcon /></span>
        {/if}
        <span class="cash" title="Cash in hand"
            ><span class="cash-label">Cash</span>${playerState.cash}</span
        >
    </div>
    {#each shares as line (line.companyId)}
        <div class="line" title="${line.each} a share at the next payout">
            <span class="items">
                {#each Array.from({ length: line.count }, (_, index) => index) as share (share)}
                    <ShareCertificate companyId={line.companyId} />
                {/each}
            </span>
            <span class="leader"></span>
            <span class="amount">+${line.amount}</span>
        </div>
    {/each}
    {#each tokens as line (line.industry)}
        <div class="line" title="${line.each} a token at the next payout">
            <span class="items">
                {#each Array.from({ length: line.count }, (_, index) => index) as token (token)}
                    <IndustryToken industry={line.industry} size={20} />
                {/each}
            </span>
            <span class="leader"></span>
            <span class="amount">+${line.amount}</span>
        </div>
    {/each}
    {#if shares.length === 0 && tokens.length === 0}
        <div class="none">No shares or tokens yet</div>
    {/if}
    {#each endBonuses as bonus (bonus.label)}
        <div class="line bonus" title={bonus.title}>
            <span class="items">{bonus.label}</span>
            <span class="leader"></span>
            <span class="amount">${bonus.amount}</span>
        </div>
    {/each}
    <div
        class="total"
        title="What this player's shares and tokens would pay if the round ended now{endBonuses.length >
        0
            ? ', game-end bonuses included'
            : ''}"
    >
        <span>Next Payout</span>
        <span class="total-amount">+${payout}</span>
    </div>
</div>

<style>
    .depot {
        position: relative;
        overflow: hidden;
        border: 1px solid #8f8a5c;
        border-left: 10px solid var(--player);
        border-radius: 4px;
        background: #f6f2da;
        color: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        box-shadow:
            inset 0 0 0 3px #f6f2da,
            inset 0 0 0 4px #b9b48a,
            0 1px 3px rgba(30, 36, 10, 0.25);
    }

    .depot.acting {
        border-color: var(--player);
        border-left-width: 10px;
        box-shadow:
            inset 0 0 0 3px #f6f2da,
            inset 0 0 0 4px var(--player),
            0 2px 6px rgba(30, 36, 10, 0.4);
    }

    .band {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 4px;
        padding: 6px 6px 4px 8px;
        border-bottom: 2px solid var(--player);
    }

    .name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
        font-variant: small-caps;
    }

    .start {
        display: inline-flex;
    }

    .cash {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-size: 16px;
        font-weight: 700;
    }

    .cash-label {
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.9;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px 3px 12px;
        font-size: 12.5px;
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
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }

    .bonus {
        background: #ece7c6;
    }

    .bonus .amount {
        font-weight: 700;
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
        align-items: center;
        margin: 2px 6px 5px;
        padding: 3px 4px 2px 6px;
        border-top: 1px solid #b9b48a;
        font-size: 12.5px;
    }

    .total-amount {
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
</style>
