<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ChoicePanel from '$lib/components/ChoicePanel.svelte'
    import BidPanel from '$lib/components/BidPanel.svelte'
    import RefillPanel from '$lib/components/RefillPanel.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import ConfirmPanel from '$lib/components/ConfirmPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import Outcomes from '$lib/components/Outcomes.svelte'
    import FinalRoundBanner from '$lib/components/FinalRoundBanner.svelte'
    import Header from '$lib/components/Header.svelte'

    const gameSession = getGameSession()
</script>

{#snippet lead()}
    <Outcomes outcomes={gameSession.outcomes} />
{/snippet}

<section
    aria-label="Actions"
    class="mx-2 mt-2 rounded-lg bg-[#f4ead6] px-4 pb-3 text-center text-[#3d2f1f]"
>
    <Header />
    <div class="pt-2">
    {#if gameSession.finalTurnPlayerId}
        <FinalRoundBanner finalTurnPlayerId={gameSession.finalTurnPlayerId} />
    {/if}
    {#if gameSession.gameState.result}
        <GameEndPanel {lead} />
    {:else if gameSession.canBid}
        <BidPanel {lead} />
    {:else if gameSession.canRefill}
        <RefillPanel {lead} />
    {:else if gameSession.canConfirm}
        <ConfirmPanel {lead} />
    {:else if gameSession.canMove || gameSession.canAuction}
        <ChoicePanel {lead} />
    {:else}
        <WaitingPanel {lead} />
    {/if}
    </div>
</section>
