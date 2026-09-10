<script lang="ts">
    import type { Game } from '@tabletop/common'
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
    import GameCard from './GameCard.svelte'
    let { games, ondelete }: { games: Game[]; ondelete?: (game: Game) => void } = $props()

    function measureCard(node: HTMLLIElement) {
        const observer = new ResizeObserver(([entry]) => {
            node.style.setProperty(
                '--card-rows',
                String(Math.ceil(entry.borderBoxSize[0].blockSize) + 16)
            )
        })
        for (const content of node.children) observer.observe(content)
        return { destroy: () => observer.disconnect() }
    }
</script>

<ul class="dashboard-game-list">
    {#each games as game (game.id)}
        <li use:measureCard animate:flip={{ duration: prefersReducedMotion.current ? 0 : 250 }}>
            <div>
                <GameCard
                    {game}
                    {ondelete}
                    class="mx-0 mb-0 w-full min-w-0 max-w-none px-4 pt-4 pb-2 border border-gray-700/60 dark:border-gray-700/60 rounded-xl bg-gray-800/50 dark:bg-gray-800/50"
                />
            </div>
        </li>
    {/each}
</ul>

<style>
    .dashboard-game-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: 1px;
        grid-auto-flow: dense;
        column-gap: 16px;
        align-items: start;
    }
    li {
        min-width: 0;
        grid-row-end: span var(--card-rows, 1);
        grid-column: 1;
    }
    li:nth-child(even) {
        grid-column: 2;
    }
    @media (max-width: 850px) {
        .dashboard-game-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
    }
</style>
