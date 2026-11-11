<script lang="ts">
    // The bid menu's table on a narrow screen: each bid on two short lines (value, name, teams,
    // goal; then talon and rule tags). The pointed-at bid unfolds its description in place, and
    // Besserrufer unfolds its bird buttons. Without hover, a first tap only unfolds a bid.
    import type { BidChoice } from '@tabletop/koenigrufen'
    import { bidRows, type BidRow } from '$lib/utils/bidRows.js'
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'
    import BirdButtons from './BirdButtons.svelte'
    import RuleTags from './RuleTags.svelte'

    let {
        choices,
        onchoose
    }: { choices: readonly BidChoice[]; onchoose: (choice: BidChoice) => void } = $props()

    const rows = $derived(bidRows(choices))
    const preview = new ChoicePreview<string>()
    const shown = $derived(preview.shownAmong(rows.map((row) => row.key)))

    function choose(row: BidRow) {
        if (row.birds.length > 0 || (preview.noHover.current && shown !== row.key)) {
            preview.previewed = row.key
            return
        }
        onchoose(row.choice)
    }
</script>

<div class="table" role="list">
    <div class="head" aria-hidden="true">
        <span class="value">Value</span><span>Contract</span><span>Teams</span><span>Goal</span>
    </div>
    {#each rows as row (row.key)}
        <div
            class="row"
            class:shown={shown === row.key}
            role="listitem"
            onpointerenter={(event) => preview.showOnHover(event, row.key)}
        >
            <button
                type="button"
                class="line"
                onfocus={(event) => preview.showOnKeyboardFocus(event, row.key)}
                onclick={() => choose(row)}
            >
                <span class="value">{row.value}</span>
                <span class="name">{row.name}</span>
                <span>{row.teams}</span>
                <span>{row.goalShort}</span>
                <span class="extra">
                    <span><span class="label">Talon:</span> {row.talon}</span>
                    <RuleTags tags={row.tags} />
                </span>
            </button>
            {#if shown === row.key}
                <div class="unfold">
                    <p>{row.details}</p>
                    {#if row.birds.length > 0}
                        <div class="birds"><BirdButtons birds={row.birds} {onchoose} /></div>
                    {/if}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .table {
        --cols: 2.2rem minmax(0, 1fr) 3.2rem 4.6rem;
        font-size: 0.78rem;
    }

    .head,
    .line {
        display: grid;
        grid-template-columns: var(--cols);
        align-items: baseline;
        gap: 8px;
    }

    .head {
        padding: 0 8px 4px;
        color: #f2c94c;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-bottom: 1px solid rgb(242 201 76 / 0.45);
    }

    .row {
        border-bottom: 1px solid rgb(241 231 207 / 0.08);
    }

    .line {
        width: 100%;
        padding: 6px 8px;
        border: 0;
        background: none;
        color: #f1e7cf;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .row:hover,
    .shown {
        background: rgb(242 201 76 / 0.1);
    }

    .value {
        text-align: right;
    }

    .line .value {
        color: #f2c94c;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .name {
        font-weight: 700;
    }

    .extra {
        display: flex;
        flex-wrap: wrap;
        grid-column: 2 / -1;
        align-items: baseline;
        gap: 4px 8px;
        font-size: 0.72rem;
    }

    .label {
        opacity: 0.6;
    }

    .unfold {
        padding: 0 10px 8px calc(2.2rem + 16px);
        font-size: 0.8rem;
        line-height: 1.35;
    }

    .unfold p {
        margin: 0;
        opacity: 0.85;
    }

    .birds {
        margin-top: 6px;
    }
</style>
