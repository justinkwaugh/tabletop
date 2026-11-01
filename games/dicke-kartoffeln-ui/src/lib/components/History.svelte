<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeSystemAction, outcomeReceipt, type ReceiptLine } from '$lib/utils/describe.js'
    import { historyEntries, type HistoryEntry, type YearEntry } from '$lib/utils/history.js'
    import { roundLabel } from '$lib/utils/rounds.js'
    import DescriptionText from './Description.svelte'

    type LedgerRow = { entry: Exclude<HistoryEntry, YearEntry>; lines: ReceiptLine[]; number: number }
    type LedgerPage = { year: YearEntry | undefined; rows: LedgerRow[] }

    const gameSession = getGameSession()

    const board = $derived(gameSession.gameState.marketBoard())
    const pages = $derived.by(() => {
        const entries = historyEntries(
            gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0)),
            gameSession.gameState.years.series
        )
        const result: LedgerPage[] = []
        let number = 0
        for (const entry of entries) {
            if (entry.kind === 'year') {
                result.push({ year: entry, rows: [] })
                continue
            }
            const lines = receiptLines(entry)
            if (lines.length === 0) continue
            number += 1
            if (result.length === 0) result.push({ year: undefined, rows: [] })
            result[result.length - 1].rows.push({ entry, lines, number })
        }
        return result
            .map((page) => ({ ...page, rows: page.rows.toReversed() }))
            .toReversed()
    })

    function receiptLines(entry: Exclude<HistoryEntry, YearEntry>): ReceiptLine[] {
        if (entry.kind === 'planning') {
            return (
                entry.reveal?.metadata?.outcomes.map(outcomeReceipt) ??
                entry.sealed.map((playerId) => ({ description: [{ playerId }, 'sealed a plan'] }))
            )
        }
        return describeSystemAction(entry.action, board).map((description) => ({ description }))
    }

    function lastIndex(entry: HistoryEntry): number | undefined {
        switch (entry.kind) {
            case 'year':
                return entry.firstIndex
            case 'planning':
                return entry.lastIndex
            case 'event':
                return entry.action.index
        }
    }

    async function jumpTo(entry: HistoryEntry) {
        const index = lastIndex(entry)
        if (index !== undefined) {
            await gameSession.history.goToActionIndex(index)
        }
    }

    function onKey(event: KeyboardEvent, entry: HistoryEntry) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void jumpTo(entry)
        }
    }

    function amountText(amount: number): string {
        return `${amount > 0 ? '+' : '−'}${Math.abs(amount).toLocaleString('en-US')}`
    }

    function pageNumber(year: number | undefined): string {
        return `P.${String(year ?? 0).padStart(2, '0')}`
    }
</script>

<div class="printout">
    <div class="fax-line">
        <span>FAX</span><span>AGRICULTURAL PRESS SERVICE · DREIEICH</span><span
            >{pageNumber(gameSession.gameState.years.series.length)}</span
        >
    </div>
    <div class="masthead">
        <div class="title">FARM LEDGER</div>
        <div class="subtitle">All sums in marks</div>
    </div>
    {#if gameSession.gameState.result}
        <div class="final">
            <div class="banner">*** HARVEST HOME ***</div>
            <div class="winners">
                {#each gameSession.gameState.winningPlayerIds as playerId, index (playerId)}
                    {#if index > 0}and{/if}
                    <PlayerName {playerId} />
                {/each}
                {gameSession.gameState.winningPlayerIds.length > 1 ? 'share the win' : 'wins'}
            </div>
        </div>
    {/if}
    <div class="columns"><span>NO.</span><span>ENTRY</span><span>MARKS</span></div>
    {#each pages as page (page.year?.key ?? 'setup')}
        {#if page.year}
            {@const year = page.year}
            <div
                class="page jump"
                role="button"
                tabindex="0"
                title="Show the start of this year"
                onclick={() => jumpTo(year)}
                onkeydown={(event) => onKey(event, year)}
            >
                <span>YEAR {year.year}</span><span>{pageNumber(year.year)}</span>
            </div>
        {/if}
        {#each page.rows as { entry, lines, number } (entry.key)}
            {@const label = roundLabel(entry.round)}
            <section class="entry">
                <div
                    class="head jump"
                    role="button"
                    tabindex="0"
                    title="Show the table after this"
                    onclick={() => jumpTo(entry)}
                    onkeydown={(event) => onKey(event, entry)}
                >
                    <span class="number">{String(number).padStart(4, '0')}</span>
                    <span class="round"
                        >{label ? `${label.number} ${label.name}` : 'Final reckoning'}</span
                    >
                </div>
                {#each lines as line, index (index)}
                    <div class="line">
                        <span class="text"><DescriptionText description={line.description} /></span>
                        {#if line.amount !== undefined}
                            <span class="amount" class:debit={line.amount < 0}
                                >{amountText(line.amount)}</span
                            >
                        {/if}
                    </div>
                {/each}
            </section>
        {/each}
        <div class="tear" aria-hidden="true"></div>
    {/each}
    <div class="end">*** END OF TRANSMISSION · TX OK ***</div>
</div>

<style>
    .printout {
        --paper: #fbfbf3;
        --bar: #e2eedb;
        --ink: #26262b;
        --margin: 15px;
        position: relative;
        padding: 6px calc(var(--margin) + 6px) 10px;
        background:
            radial-gradient(circle, #c8d1b0 3.2px, #c9c6b4 3.7px, transparent 4.2px) left top /
                var(--margin) 16px repeat-y,
            radial-gradient(circle, #c8d1b0 3.2px, #c9c6b4 3.7px, transparent 4.2px) right top /
                var(--margin) 16px repeat-y,
            var(--paper);
        box-shadow: 0 1px 3px rgba(40, 30, 10, 0.3);
        color: var(--ink);
        font-family: 'Kartoffeln Typewriter', 'Courier New', monospace;
        font-size: 13px;
    }

    .printout::before,
    .printout::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        border-left: 1px dashed #c3bfa8;
    }

    .printout::before {
        left: var(--margin);
    }

    .printout::after {
        right: var(--margin);
    }

    .fax-line {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        margin: 0 -2px 6px;
        border-bottom: 1px solid var(--ink);
        padding-bottom: 2px;
        font-size: 9.5px;
        letter-spacing: 0.04em;
        white-space: nowrap;
    }

    .fax-line span:nth-child(2) {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .masthead {
        text-align: center;
    }

    .title,
    .banner,
    .columns,
    .page,
    .head,
    .amount,
    .end {
        font-family: 'Kartoffeln Dots', 'Courier New', monospace;
        font-weight: 900;
    }

    .title {
        font-size: 26px;
        letter-spacing: 0.12em;
        line-height: 1.1;
    }

    .subtitle {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .final {
        margin-top: 6px;
        padding: 4px 0;
        border-top: 2px solid var(--ink);
        border-bottom: 2px solid var(--ink);
        text-align: center;
    }

    .banner {
        font-size: 15px;
        letter-spacing: 0.1em;
    }

    .winners {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .columns {
        display: grid;
        grid-template-columns: 54px 1fr auto;
        margin-top: 8px;
        padding: 2px 0;
        border-top: 3px double var(--ink);
        border-bottom: 1px solid var(--ink);
        font-size: 13px;
        letter-spacing: 0.08em;
    }

    .page {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        padding: 3px 0 2px;
        border-bottom: 1px solid var(--ink);
        font-size: 15px;
        letter-spacing: 0.1em;
    }

    .entry {
        margin: 0 -4px;
        padding: 3px 4px 4px;
    }

    .entry:nth-of-type(odd) {
        background: var(--bar);
    }

    .head {
        display: grid;
        grid-template-columns: 54px 1fr;
        font-size: 15px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .number {
        color: #55555a;
    }

    .jump {
        cursor: pointer;
    }

    .jump:hover,
    .jump:focus-visible {
        outline: none;
        background: rgba(200, 150, 26, 0.18);
    }

    .line {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding-left: 12px;
        font-size: 12.5px;
        line-height: 1.4;
    }

    .text {
        flex: 1;
        min-width: 0;
    }

    .amount {
        flex: none;
        font-size: 15px;
    }

    .amount.debit {
        color: #a3221c;
    }

    .tear {
        height: 10px;
        margin: 2px calc(-1 * var(--margin) - 6px);
        background: linear-gradient(var(--ink), var(--ink)) center / 100% 1px no-repeat;
        mask: repeating-linear-gradient(90deg, #000 0 5px, transparent 5px 9px);
        opacity: 0.45;
    }

    .end {
        margin-top: 6px;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-align: center;
    }
</style>
