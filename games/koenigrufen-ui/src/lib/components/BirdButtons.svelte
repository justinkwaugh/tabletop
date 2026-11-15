<script lang="ts">
    // Besserrufer's birds as bid buttons. Birds the player can't bid now stay visible, disabled.
    // `full` lists them one per line with each bird's goal.
    import type { BidChoice } from '@tabletop/koenigrufen'
    import type { BirdOption } from '$lib/utils/bidRows.js'

    let {
        birds,
        onchoose,
        full = false
    }: { birds: BirdOption[]; onchoose: (choice: BidChoice) => void; full?: boolean } = $props()
</script>

<div class="birds" class:full>
    {#each birds as bird (bird.key)}
        <button
            type="button"
            class="bird"
            disabled={!bird.open}
            title={bird.open ? bird.goal : 'Not open to you'}
            onclick={(event) => (event.stopPropagation(), onchoose(bird.choice))}
        >
            <span class="name">{bird.name}</span>
            <span class="value">{bird.value}</span>
            {#if full}<span class="goal">{bird.goal}</span>{/if}
        </button>
    {/each}
</div>

<style>
    .birds {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .full {
        display: grid;
        gap: 4px;
    }

    .bird {
        display: inline-flex;
        align-items: baseline;
        gap: 5px;
        padding: 2px 8px;
        border: 1px solid rgb(242 201 76 / 0.55);
        border-radius: 999px;
        background: rgb(242 201 76 / 0.1);
        color: #f1e7cf;
        font: inherit;
        font-size: 0.8rem;
        cursor: pointer;
        white-space: nowrap;
    }

    .full .bird {
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: 8px;
        padding: 4px 10px;
        border-radius: 6px;
        text-align: left;
        white-space: normal;
    }

    .bird:hover:not(:disabled),
    .bird:focus-visible {
        background: rgb(242 201 76 / 0.3);
    }

    .bird:disabled {
        border-style: dashed;
        background: none;
        cursor: default;
        opacity: 0.35;
    }

    .name {
        font-weight: 700;
    }

    .value {
        color: #f2c94c;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .goal {
        font-size: 0.75rem;
        opacity: 0.8;
    }
</style>
