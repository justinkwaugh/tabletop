<script lang="ts">
    import { VARIETIES, type Variety } from '@tabletop/dicke-kartoffeln'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FIELD_IDS, sownVarieties, yieldSheet, type SheetYear } from '$lib/utils/ledger.js'
    import { sowingDecided } from '$lib/utils/rounds.js'
    import FieldCell from './FieldCell.svelte'
    import HarvestChart from './HarvestChart.svelte'
    import MarketCell from './MarketCell.svelte'
    import MarketSummary from './MarketSummary.svelte'
    import ScoreCard from './ScoreCard.svelte'
    import { compactTable } from '$lib/utils/tableLayout.svelte.js'

    const compact = $derived(compactTable.current)

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()

    const years = $derived(Array.from({ length: gameSession.setup.years }, (_, index) => index + 1))
    const rows = $derived(
        yieldSheet(gameSession.actions, gameSession.gameState.years.series, playerId)
    )
    const currentYear = $derived(gameSession.gameState.result ? undefined : gameSession.year)
    const editing = $derived(gameSession.planning && playerId === gameSession.myPlayerId)
    const rowHeight = $derived(Math.min(118, 760 / years.length))

    // A phone shows one year's page at a time, the current one unless another was picked
    // during this year.
    let picked: { year: number; during: number | undefined } | undefined = $state()
    const shownYear = $derived(
        picked !== undefined && picked.during === currentYear
            ? picked.year
            : (currentYear ?? years.length)
    )
    const shownEntry = $derived(rows.find((row) => row.year === shownYear))

    // Once a year's sowing is settled, only the varieties sown that year keep a profit column.
    function grows(year: number, entry: SheetYear | undefined, variety: Variety): boolean {
        const settled =
            currentYear === undefined ||
            year < currentYear ||
            (year === currentYear && sowingDecided(gameSession.shownRound))
        return !settled || sownVarieties(entry).includes(variety)
    }
</script>

<div class="sheet" class:compact style:width="{compact ? 360 : 1300}px">
    <div class="form">
        <div class="banner">
            <span class="formtitle">YIELD SHEET</span>
            <span class="farmer">farmer: <PlayerName {playerId} /></span>
            {#if !gameSession.hasCompleteHistory}<span class="loading">reading old pages…</span
                >{/if}
        </div>
        {#if compact}
            <div
                class="years"
                role="group"
                aria-label="Year shown"
                style:grid-template-columns="44px repeat({years.length}, 1fr)"
            >
                <div class="h strip-head">YEAR</div>
                <div class="h strip-head profit-row">PROFIT</div>
                {#each years as year (year)}
                    {@const entry = rows.find((row) => row.year === year)}
                    <button
                        type="button"
                        class="year-tab"
                        class:selected={year === shownYear}
                        class:current={year === currentYear}
                        aria-pressed={year === shownYear}
                        aria-label="Year {year}{entry?.income !== undefined
                            ? `, profit ${entry.income}`
                            : ''}"
                        onclick={() => (picked = { year, during: currentYear })}
                    >
                        <span class="tab-year">{year}</span>
                        <span class="tab-profit">
                            {#if entry?.income !== undefined}
                                <span class="sum">{entry.income}</span>
                                {#if entry.prize > 0}<span class="prize">+{entry.prize}</span>{/if}
                            {/if}
                        </span>
                    </button>
                {/each}
            </div>
            <div class="page">
                <div class="h page-head">YEAR {shownYear}</div>
                <div class="h2 field-head">FIELD</div>
                <div class="h2">SEED</div>
                <div class="h2">YIELD</div>
                <div class="h2 sale-head">NORM</div>
                <div class="h2 sale-head">BIO</div>
                {#each FIELD_IDS as fieldId (fieldId)}
                    <div class="field-number">{fieldId}</div>
                    <FieldCell
                        {fieldId}
                        entry={shownEntry?.fields[fieldId]}
                        own={shownYear === currentYear && playerId === gameSession.myPlayerId}
                        editing={editing && shownYear === currentYear}
                        row
                    />
                {/each}
            </div>
        {:else}
            <div
                class="grid"
                style:grid-template-rows="30px 26px repeat({years.length}, {rowHeight}px)"
            >
                <div class="h year-head">YEAR</div>
                <div class="h span-fields">YIELD AND SALES VOLUME</div>
                <div class="h span-markets">PROFIT CALCULATION</div>
                <div class="h profit-head">PROFIT</div>
                {#each FIELD_IDS as fieldId (fieldId)}
                    <div class="h2">FIELD {fieldId}</div>
                {/each}
                {#each VARIETIES as variety (variety)}
                    <div class="h2 variety">
                        {variety.toUpperCase()}
                        <small>NORM | BIO</small>
                    </div>
                {/each}
                {#each years as year (year)}
                    {@const entry = rows.find((row) => row.year === year)}
                    {@const current = year === currentYear}
                    <div class="year">{year}</div>
                    {#each FIELD_IDS as fieldId (fieldId)}
                        <div class="slot">
                            <FieldCell
                                {fieldId}
                                entry={entry?.fields[fieldId]}
                                own={current && playerId === gameSession.myPlayerId}
                                editing={editing && current}
                            />
                        </div>
                    {/each}
                    {#each VARIETIES as variety (variety)}
                        <div class="slot">
                            <MarketCell
                                {variety}
                                {entry}
                                {current}
                                grown={grows(year, entry, variety)}
                            />
                        </div>
                    {/each}
                    <div class="profit">
                        {#if entry?.income !== undefined}
                            <span class="sum">{entry.income}</span>
                            {#if entry.prize > 0}<span class="prize">+{entry.prize} prize</span>{/if}
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
    <div class="side">
        <div class="tabs">
            {#each gameSession.gameState.players as player (player.playerId)}
                <button
                    type="button"
                    class="tab"
                    class:selected={player.playerId === playerId}
                    style:background={gameSession.colors.getPlayerBgColorValue(player.playerId)}
                    title="Show this yield sheet"
                    onclick={() => gameSession.showSheet(player.playerId)}
                >
                    <PlayerName playerId={player.playerId} capitalization="uppercase" />
                </button>
            {/each}
        </div>
        <MarketSummary />
        <HarvestChart />
        <ScoreCard {playerId} />
    </div>
</div>

<style>
    .sheet {
        display: flex;
        gap: 14px;
        border-radius: 4px;
        background: #fffdf6;
        padding: 14px;
        box-shadow: 0 4px 14px rgba(40, 30, 10, 0.4);
        color: #1d1d1d;
    }

    .sheet.compact {
        flex-direction: column;
    }

    .sheet.compact .side {
        width: auto;
    }

    .form {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 6px;
    }

    .banner {
        display: flex;
        align-items: baseline;
        gap: 24px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
    }

    .formtitle {
        font-size: 40px;
        letter-spacing: 0.05em;
    }

    .farmer {
        font-size: 20px;
    }

    .loading {
        color: #8b8b8b;
        font-size: 16px;
    }

    .grid {
        display: grid;
        grid-template-columns: 46px repeat(5, 1fr) repeat(3, 0.92fr) 78px;
        border: 3px solid #1d1d1d;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
    }

    .h,
    .h2 {
        display: flex;
        align-items: center;
        justify-content: center;
        border-right: 1.5px solid #1d1d1d;
        border-bottom: 1.5px solid #1d1d1d;
    }

    .h {
        font-size: 19px;
    }

    .year-head,
    .profit-head {
        grid-row: span 2;
        font-size: 15px;
    }

    .span-fields {
        grid-column: span 5;
        border-right-width: 3px;
    }

    .span-markets {
        grid-column: span 3;
        border-right-width: 3px;
    }

    .h2 {
        font-size: 14px;
    }

    .variety {
        flex-direction: column;
        line-height: 1;
    }

    .variety small {
        font-size: 9px;
    }

    .year {
        display: flex;
        align-items: center;
        justify-content: center;
        border-right: 3px solid #1d1d1d;
        border-top: 3px solid #1d1d1d;
        font-size: 30px;
    }

    .slot {
        min-height: 0;
        border-top: 3px solid #1d1d1d;
    }

    .slot:nth-child(10n + 7),
    .slot:nth-child(10n + 10) {
        border-right: 1.5px solid #1d1d1d;
    }

    .profit {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-top: 3px solid #1d1d1d;
        border-left: 1.5px solid #1d1d1d;
    }

    .sum {
        color: #1b3c8c;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 26px;
        font-weight: 700;
    }

    .prize {
        color: #1b3c8c;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 16px;
    }

    .side {
        display: flex;
        width: 320px;
        flex-direction: column;
        gap: 8px;
    }

    .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .tab {
        border: 2px solid #1d1d1d;
        border-radius: 999px;
        padding: 1px 2px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        font-size: 15px;
        box-shadow: 0 2px 0 #1d1d1d;
        opacity: 0.75;
        transition:
            transform 120ms ease-out,
            opacity 120ms ease-out;
    }

    .tab:hover {
        opacity: 1;
        transform: translateY(-2px);
    }

    .tab.selected {
        opacity: 1;
        outline: 2.5px solid #1d1d1d;
        outline-offset: 2px;
    }

    /* The phone sheet: a strip of years with their profit, then the shown year's page. */
    .sheet.compact {
        gap: 12px;
        padding: 10px;
    }

    .compact .banner {
        flex-wrap: wrap;
        gap: 0 14px;
    }

    .compact .formtitle {
        font-size: 30px;
    }

    .compact .farmer {
        font-size: 17px;
    }

    .years {
        display: grid;
        grid-template-rows: 28px 40px;
        grid-auto-flow: column;
        border: 3px solid #1d1d1d;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
    }

    .strip-head {
        border-right-width: 3px;
        font-size: 12px;
    }

    .profit-row {
        border-bottom: none;
    }

    .year-tab {
        display: grid;
        grid-row: span 2;
        grid-template-rows: 28px 40px;
        border-right: 1.5px solid #1d1d1d;
        color: #1d1d1d;
    }

    .year-tab:last-child {
        border-right: none;
    }

    .tab-year {
        display: grid;
        place-items: center;
        border-bottom: 1.5px solid #1d1d1d;
        font-size: 19px;
    }

    .tab-profit {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1;
    }

    .tab-profit .sum {
        font-size: 19px;
    }

    .tab-profit .prize {
        font-size: 12px;
    }

    .year-tab.current .tab-year {
        background: rgba(255, 228, 120, 0.35);
    }

    .year-tab.selected .tab-year {
        background: #1d1d1d;
        color: #fffdf6;
    }

    .page {
        display: grid;
        grid-template-columns: 36px 102px 56px 1fr 1fr;
        grid-template-rows: 30px 24px;
        grid-auto-rows: 56px;
        border: 3px solid #1d1d1d;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
    }

    .page-head {
        grid-column: 1 / -1;
        border-right: none;
        font-size: 19px;
    }

    .page .h2 {
        font-size: 12px;
    }

    .page .field-head {
        font-size: 10px;
    }

    .page .h2:nth-child(6) {
        border-right: none;
    }

    .sale-head {
        background: #1d1d1d;
        color: #fffdf6;
    }

    .field-number {
        display: grid;
        place-items: center;
        border-right: 3px solid #1d1d1d;
        border-bottom: 1.5px solid #1d1d1d;
        font-size: 22px;
    }
</style>
