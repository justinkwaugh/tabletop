<script lang="ts">
    // The announcement menu's table: a section for the bonuses, then one for each double word,
    // every row ticked on or off. Wide, the pointed-at row is described in a pane beside the table;
    // compact, it unfolds in place. The action panel lists what is ticked and confirms it.
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { AnnouncementRow } from '$lib/utils/announcementRows.js'
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'

    let { wide }: { wide: boolean } = $props()

    const gameSession = getGameSession()
    const sections = $derived(gameSession.announcementSections)
    const rows = $derived(sections.flatMap((section) => section.rows))
    const chosen = $derived(gameSession.chosenAnnouncementKeys)
    const preview = new ChoicePreview<string>()
    const shownKey = $derived(preview.shownAmong(rows.map((row) => row.key)))
    const shown = $derived(rows.find((row) => row.key === shownKey))

    function toggle(row: AnnouncementRow) {
        preview.previewed = row.key
        gameSession.toggleAnnouncement(row.key)
    }
</script>

{#snippet details(row: AnnouncementRow)}
    <p>{row.details}</p>
{/snippet}

<div class="split" class:wide>
    <div class="table">
        {#each sections as section (section.title)}
            <div class="section" role="group" aria-label={section.title}>
                <div class="head">
                    <span class="title">{section.title}</span>
                    <span class="value">{section.columns[0]}</span>
                    <span class="value">{section.columns[1]}</span>
                    {#if wide}<span class="note">{section.note}</span>{/if}
                </div>
                {#each section.rows as row (row.key)}
                    {@const on = chosen.includes(row.key)}
                    <div class="row" class:shown={shownKey === row.key} class:on>
                        <button
                            type="button"
                            class="line"
                            aria-pressed={on}
                            onpointerenter={(event) => preview.showOnHover(event, row.key)}
                            onfocus={(event) => preview.showOnKeyboardFocus(event, row.key)}
                            onclick={() => toggle(row)}
                        >
                            <span class="box" aria-hidden="true">{on ? '✓' : ''}</span>
                            <span class="name">{row.name}</span>
                            <span class="value">{row.values[0]}</span>
                            <span class="value">{row.values[1]}</span>
                            {#if wide}<span class="goal">{row.goal}</span>{/if}
                        </button>
                        {#if !wide && shownKey === row.key}
                            <div class="unfold">{@render details(row)}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
    {#if wide}
        <aside aria-live="polite">
            {#if shown}
                <div class="heading">{shown.heading}</div>
                {@render details(shown)}
            {/if}
        </aside>
    {/if}
</div>

<style>
    .split.wide {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 16em;
        gap: 14px;
        align-items: start;
    }

    .table {
        --cols: 1.4rem 7.5rem 4.6rem 4.6rem minmax(8rem, 1fr);
        font-size: 0.85rem;
    }

    .split:not(.wide) .table {
        --cols: 1.4rem minmax(0, 1fr) 4.2rem 4.2rem;
        font-size: 0.8rem;
    }

    .section + .section {
        margin-top: 8px;
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
        border-bottom: 1px solid rgb(242 201 76 / 0.45);
        color: #f2c94c;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    /* The section's name spans the box and name columns; its note sits over the goals. */
    .head .title {
        grid-column: 1 / 3;
        font-size: 0.8rem;
        letter-spacing: 0.04em;
    }

    .head .note {
        color: rgb(241 231 207 / 0.7);
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
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

    .on {
        background: rgb(242 201 76 / 0.22);
    }

    .box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.1rem;
        height: 1.1rem;
        border: 1.5px solid rgb(241 231 207 / 0.7);
        border-radius: 3px;
        font-size: 0.8rem;
        font-weight: 800;
        line-height: 1;
        align-self: center;
    }

    .on .box {
        border-color: #f2c94c;
        background: #f2c94c;
        color: #1b2a1f;
    }

    .name {
        font-weight: 700;
    }

    .value {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .line .value:nth-of-type(3) {
        color: #f2c94c;
        font-weight: 700;
    }

    .goal {
        opacity: 0.85;
    }

    .unfold {
        padding: 0 8px 6px calc(1.4rem + 16px);
        font-size: 0.78rem;
        line-height: 1.3;
        opacity: 0.9;
    }

    .unfold p,
    aside p {
        margin: 0;
    }

    aside {
        position: sticky;
        top: 0;
        min-height: 8em;
        padding: 10px 12px;
        border: 1px solid rgb(242 201 76 / 0.25);
        border-radius: 8px;
        background: rgb(255 255 255 / 0.03);
        font-size: 0.85rem;
        line-height: 1.35;
    }

    .heading {
        margin-bottom: 6px;
        color: #f2c94c;
        font-size: 1.05rem;
        font-weight: 700;
    }
</style>
