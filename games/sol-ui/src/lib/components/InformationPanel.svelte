<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    import Header from './Header.svelte'
    import ActionPanel from './ActionPanel.svelte'
    import WaitingPanel from './WaitingPanel.svelte'
    import Pickers from './Pickers.svelte'
    import LastActionDescription from './LastActionDescription.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2 uppercase">
    <Header />

    <div
        class="sol-font sol-panel-grid grid max-sm:leading-[18px] {!gameSession.isViewingHistory &&
        (gameSession.isMyTurn || gameSession.turnPlayer?.playerId === gameSession.myPlayer?.id)
            ? 'min-h-[60px]'
            : ''}"
    >
        {#if gameSession.isViewingHistory}
            <LastActionDescription textColor="text-[#ad9c80]" />
        {:else if gameSession.isMyTurn}
            <ActionPanel />
        {:else if gameSession.isSolarFlares || gameSession.turnPlayer?.playerId === gameSession.myPlayer?.id}
            <WaitingPanel />
        {:else}
            <LastActionDescription textColor="text-[#ad9c80]" />
        {/if}
    </div>
    {#if !gameSession.isViewingHistory && gameSession.isMyTurn}
        <Pickers />
    {/if}
</div>

<style global>
    :global(.sol-panel-grid > *) {
        grid-area: 1 / 1;
    }
</style>
