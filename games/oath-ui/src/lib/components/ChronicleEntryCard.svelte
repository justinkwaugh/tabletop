<script lang="ts">
    import { chronicleMarkOf, type ChronicleEntry } from '@tabletop/oath'
    import RecordChip from '$lib/components/RecordChip.svelte'
    import { goalSymbolImage } from '$lib/images/goalImages.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { builtWords, entryDate, ruinedWords } from '$lib/model/chronicleEntry.js'
    import { addedBySuit } from '$lib/model/chronicleDrafts.js'
    import { endingParts } from '$lib/model/endings.js'
    import { oathGoalKind } from '$lib/model/goalBoard.js'
    import { ageName, listed, oathName, suitName } from '$lib/model/names.js'

    // One game of the chronicle, as the journal page keeps it but with only what happened: the
    // table's name and the game's number, the date and the Oath it was played under, the winner's
    // story, then how it was won and what it left the next game. Names keep that game's colours.
    let { entry }: { entry: ChronicleEntry } = $props()

    // The journal's letter follows from how the game was won.
    let mark = $derived(chronicleMarkOf(entry.rule))

    let added = $derived(
        entry.added?.suits
            ? addedBySuit(entry.added.suits[0])
            : entry.added?.heal
              ? [entry.added.heal]
              : []
    )
</script>

{#snippet oath(oathType: ChronicleEntry['startingOath'], words: string)}
    {@const src = goalSymbolImage(oathGoalKind(oathType))}
    <!-- The goal's symbol as the rail draws it: a mask in the text's colour. -->
    <span class="inline-flex items-center gap-1">
        <span
            class="symbol"
            aria-hidden="true"
            style:mask-image={`url("${src}")`}
            style:-webkit-mask-image={`url("${src}")`}
        ></span>{words}
    </span>
{/snippet}

<article
    class="entry rounded-md border border-oath-frame bg-oath-surface px-3 py-2 text-sm text-oath-text"
>
    <p
        class="border-b border-oath-divider pb-1.5 text-center text-sm font-semibold uppercase tracking-[0.2em] text-oath-heading"
    >
        {ageName(entry.gameNumber)} · {entry.sessionName}
    </p>
    <p class="mt-1.5 text-oath-text-muted">
        {entryDate(entry.date)} · {@render oath(
            entry.startingOath,
            `Oath of ${oathName(entry.startingOath)}`
        )}
    </p>
    {#if entry.story !== undefined}
        <p class="story mt-2 border-t border-oath-divider pt-2 italic">{entry.story}</p>
    {/if}
    <dl class="rows mt-2 border-t border-oath-divider pt-2 [&_dt]:text-oath-text-muted">
        <dt>Won</dt>
        <dd>
            <RecordChip seat={entry.winner} />
            {endingParts(entry.rule).how}
            <span
                class="mark border-2 border-oath-heading text-oath-heading"
                aria-label="mark {mark}">{mark}</span
            >
        </dd>
        {#if entry.nextOath !== undefined}
            <dt>Next Oath</dt>
            <dd>{@render oath(entry.nextOath, oathName(entry.nextOath))}</dd>
        {/if}
        {#if added.length > 0}
            <dt>Added</dt>
            <dd
                aria-label={listed(added.map((part) => `${part.count} ${suitName(part.suit)}`))}
                class="flex flex-wrap items-center gap-2"
            >
                {#each added as part (part.suit)}
                    <span class="inline-flex items-center gap-0.5"
                        >{part.count}<img class="h-5 w-5" src={suitImage(part.suit)} alt="" /></span
                    >
                {/each}
            </dd>
        {/if}
        {#if entry.citizens && entry.citizens.length > 0}
            <dt>Citizens</dt>
            <dd class="flex flex-wrap gap-1">
                {#each entry.citizens as citizen (citizen.color)}
                    <RecordChip seat={citizen} />
                {/each}
            </dd>
        {/if}
        {#if entry.built}
            <dt>Built</dt>
            <dd>{builtWords(entry.built)}</dd>
        {/if}
        {#if entry.ruined && entry.ruined.length > 0}
            <dt>Ruined</dt>
            <dd>{listed(ruinedWords(entry.ruined))}</dd>
        {/if}
    </dl>
</article>

<style>
    .story {
        font-family: Georgia, 'Times New Roman', serif;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .rows {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        column-gap: 1rem;
        row-gap: 0.25rem;
        align-items: center;
    }
    .symbol {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        background-color: currentColor;
        mask-position: center;
        mask-size: contain;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        -webkit-mask-size: contain;
        -webkit-mask-repeat: no-repeat;
    }
    .mark {
        display: inline-flex;
        width: 1.25rem;
        height: 1.25rem;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 0.75rem;
        font-weight: 700;
        line-height: 1;
    }
</style>
