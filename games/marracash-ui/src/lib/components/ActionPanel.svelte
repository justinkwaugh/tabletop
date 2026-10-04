<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ChoicePanel from '$lib/components/ChoicePanel.svelte'
    import BidPanel from '$lib/components/BidPanel.svelte'
    import RefillPanel from '$lib/components/RefillPanel.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import ConfirmPanel from '$lib/components/ConfirmPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import MoneyReport from '$lib/components/MoneyReport.svelte'
    import FinalRoundBanner from '$lib/components/FinalRoundBanner.svelte'

    const gameSession = getGameSession()
</script>

<div class="mx-2 mt-2 rounded-lg bg-[#f4ead6] px-4 py-2 text-center text-[#3d2f1f]">
    {#if gameSession.finalTurnPlayerId}
        <FinalRoundBanner finalTurnPlayerId={gameSession.finalTurnPlayerId} />
    {/if}
    {#if gameSession.showsMoneyReport}
        <MoneyReport reports={gameSession.moneyReports} />
    {/if}
    {#if gameSession.gameState.result}
        <GameEndPanel />
    {:else if gameSession.canBid}
        <BidPanel />
    {:else if gameSession.canRefill}
        <RefillPanel />
    {:else if gameSession.canConfirm}
        <ConfirmPanel />
    {:else if gameSession.canMove || gameSession.canAuction}
        <ChoicePanel />
    {:else}
        <WaitingPanel />
    {/if}
</div>
