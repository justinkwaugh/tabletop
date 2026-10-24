<script lang="ts">
    import { range } from '@tabletop/common'
    import { defenseDieBlank } from '$lib/images/diceImages.js'
    import type { DefenseSoFar } from '$lib/model/campaignDraft.js'
    import { defenseWords } from '$lib/model/names.js'

    // R-5.5.2 — "Defense so far:", one unrolled blue die per defense die, then what defends with
    // them in words. On a phone the dice keep to one row, shrinking when 44 px would not fit.
    let { soFar }: { soFar: DefenseSoFar } = $props()

    let words = $derived(defenseWords(soFar.counts))
    let comma = $derived(words.comma ? ',' : '')
</script>

<p class="defense" data-defense-so-far>
    <span>Defense so far:{soFar.dice === 0 ? ` no dice${comma}` : ''}</span>
    {#if soFar.dice > 0}
        <span
            class="dice"
            role="img"
            aria-label="{soFar.dice} defense {soFar.dice === 1 ? 'die' : 'dice'}"
            style:--dice={soFar.dice}
            style:--comma-room={comma ? '0.5em' : '0px'}
        >
            {#each range(0, soFar.dice) as index (index)}
                <!-- The comma keeps to the last die, so a wrap never leaves it alone. -->
                <span class="die-place">
                    <img class="die" src={defenseDieBlank()} alt="" />{index === soFar.dice - 1
                        ? comma
                        : ''}
                </span>
            {/each}
        </span>
    {/if}
    <span
        >{#each words.counts as part (part.noun)}{part.joiner}<strong>{part.count}</strong>
            {part.noun}{/each}.</span
    >
</p>

<style>
    /* Set tight: on a phone the line takes three lines (words, dice, words), and the Battle plans
       step must still fit the phone's panel at full size (`FitBox`). */
    .defense {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        column-gap: 6px;
        row-gap: 2px;
        font-size: 0.875rem;
        line-height: 1rem;
    }
    .dice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }
    .die-place {
        display: flex;
        align-items: flex-end;
    }
    /* The attack dice's size: 32 px, and 44 on a phone (`AttackDiceRow`). */
    .die {
        display: block;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    /* On a phone the dice stay on one row: 44 px while they fit the line, and when they would not,
       just small enough to fill it (the comma's room kept). They are not tappable, so they may go
       under 44 px, and a second row would push the step's buttons past the panel's fit. 100cqw is
       the width of FitBox's unscaled box and 26px the action panel's padding and border (as
       `ActionGrid`'s ruler): the line's width at full size, so fitting never changes the dice. */
    @media (max-width: 639px) {
        .dice {
            flex-wrap: nowrap;
        }
        .die {
            --side: min(
                44px,
                (100cqw - 26px - 4px * (var(--dice) - 1) - var(--comma-room)) / var(--dice)
            );
            width: var(--side);
            height: var(--side);
        }
    }
</style>
