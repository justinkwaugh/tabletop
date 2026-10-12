<script lang="ts">
    import FactionConsole from './players/FactionConsole.svelte'
    import Standings from './players/Standings.svelte'
    import PlayerAreaPrototype from './prototype/playerArea/PlayerAreaPrototype.svelte'
    import { playerArea } from './prototype/playerArea/campaignMock.svelte.js'
</script>

{#if playerArea.variant}
    <PlayerAreaPrototype />
{:else}
    <div class="players">
        <Standings />
        <FactionConsole />
    </div>
{/if}

<style>
    .players {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
</style>
