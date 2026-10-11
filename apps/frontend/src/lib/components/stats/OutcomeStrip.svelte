<script lang="ts">
    import { PlayOutcome } from '@tabletop/common'

    let { outcomes }: { outcomes: PlayOutcome[] } = $props()

    const LETTERS: Record<PlayOutcome, string> = {
        [PlayOutcome.Won]: 'W',
        [PlayOutcome.Tied]: 'T',
        [PlayOutcome.Lost]: 'L'
    }
</script>

<ol class="outcomes" aria-label="Results, oldest first">
    {#each outcomes as outcome, index (index)}
        <li class={outcome} title={outcome}>{LETTERS[outcome]}</li>
    {/each}
</ol>

<style>
    .outcomes {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
    }
    li {
        width: 20px;
        height: 20px;
        border-radius: 3px;
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 600;
    }
    .won {
        background: var(--stats-mark);
        color: white;
    }
    .tied {
        box-shadow: inset 0 0 0 1.5px var(--stats-mark);
        color: var(--color-gray-100);
    }
    .lost {
        background: var(--color-gray-700);
        color: var(--color-gray-400);
    }
</style>
