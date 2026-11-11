<script lang="ts">
    import {
        LEAVE_TOWN_PAYOUT,
        type HydratedSarPlayerState
    } from '@tabletop/south-african-railroads'
    import Cube from './icons/Cube.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShareCertificate from './ShareCertificate.svelte'

    let { playerState }: { playerState: HydratedSarPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const acting = $derived(gameSession.shownState.activePlayerIds.includes(playerId))
    const lines = $derived(
        gameSession.shownState.map.railroads
            .map((railroad) => {
                const shares = gameSession.shownState.sharesHeld(railroad.id, playerId)
                const each = gameSession.shownState.nextDividendPerShare(railroad.id)
                return {
                    railroad,
                    shares,
                    each,
                    amount: shares * each,
                    controls: gameSession.shownState.controls(railroad.id, playerId)
                }
            })
            .filter((line) => line.shares > 0)
    )
    const finalPayoffNext = $derived(gameSession.shownState.isFinalPayoffNext())
    const dividend = $derived(gameSession.shownState.nextDividend(playerId))
    const projected = $derived(gameSession.shownState.projectedFinalCash(playerId))
</script>

<div class="ticket" class:acting style:--player={color}>
    <div class="band">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="cash" title="Cash in hand"
            ><span class="cash-label">Cash</span>${playerState.cash}</span
        >
    </div>
    {#each lines as line (line.railroad.id)}
        <div
            class="line"
            title="{line.railroad.shortName}: ${line.each} a share at the next {finalPayoffNext
                ? 'final payout'
                : 'dividend'}{line.controls ? ' · controls the railroad' : ''}"
        >
            <span class="certs">
                {#each Array.from({ length: line.shares }, (_, index) => index) as share (share)}
                    <ShareCertificate railroadId={line.railroad.id} />
                {/each}
            </span>
            <span class="leader"></span>
            <span class="amount">+${line.amount}</span>
        </div>
    {:else}
        {#if playerState.leaveTownCubes === 0}
            <div class="none">No shares yet</div>
        {/if}
    {/each}
    {#if playerState.leaveTownCubes > 0}
        <div class="line" title="Leave Town cubes: ${LEAVE_TOWN_PAYOUT} each at every dividend">
            <span class="certs">
                {#each Array.from({ length: playerState.leaveTownCubes }, (_, index) => index) as cube (cube)}
                    <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true"
                        ><Cube x={0} y={0} size={14} color="#eef1f2" edge="#2e4159" /></svg
                    >
                {/each}
                <span class="cube-label">Leave Town</span>
            </span>
            <span class="leader"></span>
            <span class="amount">+${gameSession.shownState.leaveTownPayout(playerId)}</span>
        </div>
    {/if}
    <div
        class="total"
        title="What this player's shares would pay if {finalPayoffNext
            ? 'the final payoff'
            : 'dividends'} were paid now"
    >
        <span>{finalPayoffNext ? 'Next Final Payout' : 'Next Dividend'}</span>
        <span class="total-amount">+${dividend}</span>
    </div>
    <div class="fine-print" title="Cash plus every share's final payoff if the game ended now">
        Score if game ended now ${projected}
    </div>
</div>

<style>
    .ticket {
        position: relative;
        overflow: hidden;
        border: 3px solid #fdfdfb;
        border-left: 12px solid var(--player);
        border-radius: 5px;
        background: #fdfdfb;
        color: #18222f;
        font-family: 'SAR Bitter', Georgia, serif;
        box-shadow:
            0 1px 0 rgba(30, 45, 60, 0.25),
            0 0 0 1px #c9d2d9;
    }

    .ticket.acting {
        border-color: var(--player);
        box-shadow: 0 2px 6px rgba(16, 22, 30, 0.4);
    }

    .band {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 10px;
        border-bottom: 1px dashed #5478a3;
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 18px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .cash {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-size: 15px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .cash-label {
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.9;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        font-size: 13px;
    }

    .certs {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px;
    }

    .leader {
        flex: 1;
        height: 8px;
        border-bottom: 1px dotted #446083;
    }

    .cube-label {
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .amount {
        font-variant-numeric: tabular-nums;
    }

    .none {
        padding: 4px 10px;
        font-size: 12px;
        font-style: italic;
        color: #446083;
    }

    .total {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 4px 10px 2px;
        border-top: 1px dashed #5478a3;
        font-size: 13px;
        letter-spacing: 0.02em;
    }

    .total-amount {
        font-size: 15px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .fine-print {
        padding: 0 10px 5px;
        font-size: 10.5px;
        color: #446083;
    }
</style>
