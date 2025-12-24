<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    import Header from './Header.svelte'
    import ActionPanel from './ActionPanel.svelte'
    import WaitingPanel from './WaitingPanel.svelte'
    import Pickers from './Pickers.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2 uppercase">
    <Header />

    <div class="panel-grid grid h-[60px]">
        {#if gameSession.isMyTurn}
            <ActionPanel />
        {:else}
            <WaitingPanel />
        {/if}
    </div>
    <Pickers />
</div>

<style>
    .panel-grid > * {
        grid-area: 1 / 1;
    }
</style>
