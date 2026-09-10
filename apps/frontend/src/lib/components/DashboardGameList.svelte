<script lang="ts">
    import type { Game } from '@tabletop/common'
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
    import GameCard from './GameCard.svelte'
    let { games, ondelete }: { games: Game[]; ondelete?: (game: Game) => void } = $props()
</script>

<ul class="dashboard-game-list">
    {#each games as game (game.id)}
        <li animate:flip={{ duration: prefersReducedMotion.current ? 0 : 250 }}>
            <GameCard
                {game}
                {ondelete}
                class="mx-0 mb-0 w-full min-w-0 max-w-none px-4 pt-4 pb-2 border border-gray-700/60 dark:border-gray-700/60 rounded-xl bg-gray-800/50 dark:bg-gray-800/50"
            />
        </li>
    {/each}
</ul>

<style>
    .dashboard-game-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        align-items: start;
    }
    li {
        min-width: 0;
    }
    @media (max-width: 850px) {
        .dashboard-game-list {
            grid-template-columns: 1fr;
        }
    }
</style>
