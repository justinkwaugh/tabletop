<script lang="ts">
    import type { AuctionSummaryPlayer } from './auctionSummary.js'

    let {
        players,
        emphasis = true
    }: {
        players: readonly AuctionSummaryPlayer[]
        /** Whether the names stand out from the sentence, as a summary's figures do. */
        emphasis?: boolean
    } = $props()
</script>

{#each players as player, index (player.id)}{#if index},
    {/if}<span class="player"
        ><span class="dot" style:background={player.color} aria-hidden="true"
        ></span>{#if emphasis}<strong>{player.name}</strong>{:else}{player.name}{/if}</span
    >{/each}

<style>
    .player {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }
    .dot {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 50%;
    }
</style>
