<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { EndDieStakes } from '$lib/model/endOfRound.js'

    // R-3.3, R-3.3.1 — what the end die decides, in the End die panel's words.
    let { stakes, viewerId }: { stakes: EndDieStakes; viewerId: string | undefined } = $props()
</script>

A <b class="text-oath-danger">{stakes.threshold}</b> ends the game:
{#if stakes.winnerId === viewerId}
    you win {stakes.as}.
{:else}
    <PlayerName playerId={stakes.winnerId} /> wins {stakes.as}.
{/if}
