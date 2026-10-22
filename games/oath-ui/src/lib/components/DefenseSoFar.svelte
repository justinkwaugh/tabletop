<script lang="ts">
    import { range } from '@tabletop/common'
    import { defenseDieBlank } from '$lib/images/diceImages.js'
    import type { DefenseSoFar } from '$lib/model/campaignDraft.js'
    import { defenseWords } from '$lib/model/names.js'

    // R-5.5.2 — "Defense so far:", one unrolled blue die per defense die, then what defends with
    // them in words. The dice wrap at their own size rather than shrink.
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
    @media (max-width: 639px) {
        .die {
            width: 44px;
            height: 44px;
        }
    }
</style>
