<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import UpcomingRound from './UpcomingRound.svelte'

    const gameSession = getGameSession()
</script>

{#if gameSession.upcomingCard}
    <section class="upcoming-strip" aria-label="Upcoming round">
        <UpcomingRound card={gameSession.upcomingCard} compact />
    </section>
{/if}

<style>
    .upcoming-strip {
        display: none;
    }

    @media (max-width: 639px) {
        .upcoming-strip {
            display: block;
            margin: 8px 0 0;
            padding: 4px 8px 6px;
            border-radius: 10px;
            background: #e9e0cc;
        }
    }
</style>
