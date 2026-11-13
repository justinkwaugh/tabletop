<script lang="ts">
    // The bid menu's table where there is room for it: one line per bid, its description in a
    // pane beside the table. Clicking a bid makes it; clicking Besserrufer holds the pane on its
    // bird buttons, so the pointer can cross other rows to reach them. Without hover, a first tap
    // only shows a bid. Closed rows only show their description.
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
    let held: string | undefined = $state()
    const shownKey = $derived.by(() => {
        const keys = rows.map((row) => row.key)
        return held !== undefined && keys.includes(held) ? held : preview.shownAmong(keys)
    })
    const shown = $derived(rows.find((row) => row.key === shownKey))

    function choose(row: BidRow) {
        if (row.birds.length > 0 || row.closed) {
            held = row.key
        } else if (preview.noHover.current && shownKey !== row.key) {
            held = undefined
            preview.previewed = row.key
        } else {
            onchoose(row.choice)
        }
    }
</script>

<div class="split">
    <div class="table" role="list">
        <div class="head" aria-hidden="true">
            <span class="value">Value</span><span>Contract</span><span>Teams</span><span>Goal</span
            ><span>Talon</span><span>Rules</span>
        </div>
        {#each rows as row (row.key)}
            <div
                class="row"
                class:shown={shownKey === row.key}
                class:featured={row.featured}
                class:closed={row.closed}
                class:group={row.startsGroup}
                role="listitem"
                onpointerenter={(event) => preview.showOnHover(event, row.key)}
            >
                <button
                    type="button"
                    class="line"
                    aria-disabled={row.closed}
                    onfocus={(event) => preview.showOnKeyboardFocus(event, row.key)}
                    onclick={() => choose(row)}
                >
                    <span class="value">{row.value}</span>
                    <span class="name">{row.name}</span>
                    <span>{row.teams}</span>
                    <span>{row.goal}</span>
                    <span>{row.talon}</span>
                    <RuleTags tags={row.tags} />
                </button>
            </div>
        {/each}
    </div>
    <aside aria-live="polite">
        {#if shown}
            <div class="heading">
                <span class="title">{shown.name}</span>
                <span class="worth">{shown.value}</span>
            </div>
            <p>{shown.details}</p>
            {#if shown.closed}
                <p class="hint">Say Mein Spiel first.</p>
            {:else if shown.birds.length > 0}
                <BirdButtons birds={shown.birds} {onchoose} full />
            {:else if preview.noHover.current}
                <p class="hint">Tap again to bid.</p>
            {/if}
        {/if}
    </aside>
</div>

<style>
    .split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 17em;
        gap: 14px;
        align-items: start;
    }

    .table {
        --cols: 2.4rem 7.6rem 3.6rem 8.4rem 6.4rem minmax(6rem, 1fr);
        font-size: 0.85rem;
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
        background: rgb(242 201 76 / 0.12);
    }

    .shown {
        box-shadow: inset 3px 0 0 #f2c94c;
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

    .featured {
        background: rgb(242 201 76 / 0.08);
    }

    .featured .name {
        color: #f2c94c;
    }

    .closed .line {
        opacity: 0.4;
        cursor: default;
    }

    .group {
        border-top: 1px solid rgb(242 201 76 / 0.45);
    }

    aside {
        position: sticky;
        top: 0;
        min-height: 12em;
        padding: 10px 12px;
        border: 1px solid rgb(242 201 76 / 0.25);
        border-radius: 8px;
        background: rgb(255 255 255 / 0.03);
        font-size: 0.85rem;
        line-height: 1.35;
    }

    aside p {
        margin: 0 0 8px;
    }

    .heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 6px;
    }

    .title {
        font-size: 1.05rem;
        font-weight: 700;
    }

    .worth {
        color: #f2c94c;
        font-weight: 700;
    }

    .hint {
        font-style: italic;
        opacity: 0.6;
    }
</style>
