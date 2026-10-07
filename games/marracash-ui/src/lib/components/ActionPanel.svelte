<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ChoicePanel from '$lib/components/ChoicePanel.svelte'
    import BidPanel from '$lib/components/BidPanel.svelte'
    import RefillPanel from '$lib/components/RefillPanel.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import HistoryStepPanel from '$lib/components/HistoryStepPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import Outcomes from '$lib/components/Outcomes.svelte'
    import FinalRoundBanner from '$lib/components/FinalRoundBanner.svelte'
    import Header from '$lib/components/Header.svelte'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const gameSession = getGameSession()
</script>

{#snippet lead()}
    <Outcomes outcomes={gameSession.outcomes} />
{/snippet}

<section
    aria-label="Actions"
    class="panel relative mx-2 text-center text-[#3d2f1f]"
    style:--tile-light={PanelPalette.tileLight}
    style:--tile-deep={PanelPalette.tileDeep}
    style:--trim={PanelPalette.trim}
    style:--brass={PanelPalette.brass}
    style:--gold={PanelPalette.gold}
    style:--scroll-light={PanelPalette.scrollLight}
    style:--scroll-deep={PanelPalette.scrollDeep}
    style:--scroll-inset={PanelPalette.scrollInset}
>
    <Header />
    <div class="body">
        {#if gameSession.finalTurnPlayerId}
            <FinalRoundBanner finalTurnPlayerId={gameSession.finalTurnPlayerId} />
        {/if}
        {#if gameSession.isViewingHistory}
            <HistoryStepPanel />
        {:else if gameSession.gameState.result}
            <GameEndPanel {lead} />
        {:else if gameSession.canBid}
            <BidPanel {lead} />
        {:else if gameSession.canRefill}
            <RefillPanel {lead} />
        {:else if gameSession.canMove || gameSession.canAuction}
            <ChoicePanel {lead} />
        {:else}
            <WaitingPanel {lead} />
        {/if}
    </div>
</section>

<style>
    .panel {
        --header-height: 34px;
        margin-top: calc(var(--header-height) / 2);
        border-radius: 10px;
        background: linear-gradient(var(--scroll-light), var(--scroll-deep));
        box-shadow:
            inset 0 0 0 2px var(--trim),
            inset 0 0 0 5px var(--scroll-inset),
            inset 0 0 0 6px color-mix(in srgb, var(--trim) 55%, transparent);
    }

    .body {
        padding: calc(var(--header-height) / 2 + 5px) 16px 16px;
    }

    @media (max-width: 639px) {
        .panel {
            --header-height: 30px;
        }

        .body {
            padding: calc(var(--header-height) / 2 + 8px) 10px 12px;
        }
    }
</style>
