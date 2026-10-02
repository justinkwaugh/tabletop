<script lang="ts">
    import type { ActionCard } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AllowanceList from './AllowanceList.svelte'
    import FolderTab from './FolderTab.svelte'
    import SeatSquares from './SeatSquares.svelte'

    let { card }: { card: ActionCard } = $props()

    const gameSession = getGameSession()
</script>

<FolderTab side="right" label="Upcoming round">
    <div class="upcoming">
        <span class="next-label">Next</span>
        <AllowanceList {card} label="Next round's actions" compact />
        <div class="section">
            <SeatSquares playerIds={gameSession.gameState.turnOrderForCard(card)} compact />
        </div>
    </div>
</FolderTab>

<style>
    .upcoming {
        display: flex;
        align-items: center;
        gap: 24px;
        opacity: 0.6;
    }

    .next-label {
        font-size: 24px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .section {
        display: flex;
        align-items: center;
        height: 38px;
        padding-left: 24px;
        border-left: 2px solid #c9b394;
    }
</style>
