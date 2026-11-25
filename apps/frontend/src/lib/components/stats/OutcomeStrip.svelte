<script lang="ts">
    import { GameOutcome } from '@tabletop/common'
    import { m } from '$lib/paraglide/messages'

    let { outcomes }: { outcomes: GameOutcome[] } = $props()

    const LABELS: Record<GameOutcome, { letter: () => string; name: () => string }> = {
        [GameOutcome.Won]: {
            letter: m.content_stats_outcome_letter_won,
            name: m.content_stats_outcome_won
        },
        [GameOutcome.Tied]: {
            letter: m.content_stats_outcome_letter_tied,
            name: m.content_stats_outcome_tied
        },
        [GameOutcome.Lost]: {
            letter: m.content_stats_outcome_letter_lost,
            name: m.content_stats_outcome_lost
        }
    }
</script>

<ol class="outcomes" aria-label={m.content_stats_results_oldest_first()}>
    {#each outcomes as outcome, index (index)}
        <li class={outcome} title={LABELS[outcome].name()}>{LABELS[outcome].letter()}</li>
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
