<script lang="ts">
    import { Contracts, type HandResult } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bonusResultLine, gameDoublesLine } from '$lib/utils/announcementText.js'
    import { contractRequirement } from '$lib/utils/contractText.js'
    import { declarerSide, defenderPoints } from '$lib/utils/scoreSheet.js'

    let { result, onclose }: { result: HandResult; onclose: () => void } = $props()

    const gameSession = getGameSession()
    const sheet = $derived(gameSession.scoreSheet)
    const columns = $derived(gameSession.seatsFromMe)
    const definition = $derived(Contracts[result.contract])
    const declarers = $derived(
        declarerSide(result)
            .map((playerId) => gameSession.getPlayerName(playerId))
            .join(' & ')
    )
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }
    const bonuses = $derived(result.bonuses ?? [])
    const kontras = $derived(result.gameDoubles ?? [])
    const gameOver = $derived(gameSession.gameState.result !== undefined)

    function signed(value: number): string {
        return value > 0 ? `+${value}` : String(value)
    }

    function keepLatestInView(element: HTMLElement) {
        void sheet.rows.length
        element.scrollTop = element.scrollHeight
    }
</script>

<section class="summary" aria-label="Hand summary">
    <header>
        <h2>Hand {gameSession.handsFinished} · {definition.name}</h2>
        {#if result.playerPoints === undefined}
            <span class="verdict" class:made={result.made}
                >{result.givenUp ? 'Given up' : result.made ? 'Made' : 'Lost'}</span
            >
        {/if}
        <button type="button" class="close" aria-label="Close the hand summary" onclick={onclose}
            >×</button
        >
    </header>

    {#if result.givenUp}
        <p class="given-up">
            {declarers} gave up with the called King in the talon, paying each player.
        </p>
    {:else if result.playerPoints !== undefined}
        {@const points = result.playerPoints}
        <div class="each" style:--players={columns.length}>
            {#each columns as playerId (playerId)}
                {@const tricks = result.playerTricks?.[playerId] ?? 0}
                <div class="side">
                    <span class="who">{gameSession.getPlayerName(playerId)}</span>
                    <span class="count">{points[playerId] ?? 0}</span>
                    <span class="who">{tricks} {tricks === 1 ? 'trick' : 'tricks'}</span>
                </div>
            {/each}
        </div>
    {:else if result.declarerTricks !== undefined}
        {@const stoppedEarly = result.declarerTricks > (definition.tricksToTake ?? 0)}
        <div class="points">
            <div class="side">
                <span class="who">{declarers}</span>
                <span class="count">{result.declarerTricks}</span>
                <span class="who">{result.declarerTricks === 1 ? 'trick' : 'tricks'}</span>
            </div>
            <div class="needed">
                <span>needed</span>
                <strong>{contractRequirement(definition)}</strong>
            </div>
            <div class="side stopped">
                {#if stoppedEarly}<span>Play stopped once {declarers} failed.</span>{/if}
            </div>
        </div>
    {:else}
        <div class="points">
            <div class="side">
                <span class="who">{declarers}</span>
                <span class="count">{result.declarerPoints}</span>
            </div>
            <div class="needed">
                <span>needed</span>
                <strong>{contractRequirement(definition)}</strong>
            </div>
            <div class="side">
                <span class="who">Opponents</span>
                <span class="count">{defenderPoints(result)}</span>
            </div>
        </div>
    {/if}

    {#if kontras.length > 0 || bonuses.length > 0}
        <ul class="bonuses" aria-label="Kontras and bonuses">
            {#each kontras as entry (entry.defenderId ?? 'game')}
                <li>
                    <span
                        >{gameDoublesLine(entry, names)}{result.valat
                            ? ' (replaced by Valat)'
                            : ''}</span
                    >
                </li>
            {/each}
            {#each bonuses as bonus (`${bonus.bonus}:${bonus.side}`)}
                <li>
                    <span>{bonusResultLine(bonus)}</span>
                    <span class="score" class:gain={bonus.points > 0} class:loss={bonus.points < 0}
                        >{signed(bonus.points)}</span
                    >
                </li>
            {/each}
        </ul>
    {/if}

    <h3>{gameOver ? 'Final scores' : 'Scores so far'}</h3>
    <div class="sheet" {@attach keepLatestInView}>
        <table>
            <thead>
                <tr>
                    <th class="num">#</th>
                    <th>Contract</th>
                    <th>Declarer</th>
                    {#each columns as playerId (playerId)}
                        <th
                            class="score"
                            style:--seat={gameSession.colors.getPlayerBgColorValue(playerId)}
                        >
                            {gameSession.getPlayerName(playerId)}
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#if !sheet.complete}
                    <tr>
                        <td class="num">…</td>
                        <td class="loading" colspan={2 + columns.length}>Reading earlier hands…</td>
                    </tr>
                {/if}
                {#each sheet.rows as { hand: number, result: hand }, index (number)}
                    <tr class:latest={index === sheet.rows.length - 1}>
                        <td class="num">{number}</td>
                        <td>
                            {Contracts[hand.contract].name}
                            {#if hand.playerPoints === undefined}
                                <span class="mark" class:made={hand.made}
                                    >{hand.made ? '✓' : '✗'}</span
                                >
                            {/if}
                        </td>
                        <td>{gameSession.getPlayerName(hand.declarerId)}</td>
                        {#each columns as playerId (playerId)}
                            {@const change = hand.scoreChanges[playerId] ?? 0}
                            <td class="score" class:gain={change > 0} class:loss={change < 0}>
                                {signed(change)}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
            <tfoot>
                <tr>
                    <td></td>
                    <td colspan="2">Total</td>
                    {#each columns as playerId (playerId)}
                        <td class="score">{sheet.totals[playerId]}</td>
                    {/each}
                </tr>
            </tfoot>
        </table>
    </div>
</section>

<style>
    .summary {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 720px;
        max-height: var(--summary-height, 420px);
        padding: 16px 22px;
        font-size: calc(1.15rem * var(--summary-scale, 1));
        border-radius: 14px;
        background: rgb(16 28 20 / 0.92);
        border: 1px solid rgb(242 201 76 / 0.35);
        box-shadow: 0 6px 0 rgb(0 0 0 / 0.35);
        color: #f1e7cf;
    }

    header {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .close {
        width: 1.6em;
        height: 1.6em;
        border-radius: 50%;
        font-size: 1.1em;
        line-height: 1;
        opacity: 0.75;
    }

    .close:hover {
        opacity: 1;
        background: rgb(241 231 207 / 0.15);
    }

    h2 {
        flex: 1;
        font-size: 1.3em;
        font-weight: 700;
    }

    h3 {
        font-size: 0.75em;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
    }

    .verdict {
        padding: 2px 12px;
        border-radius: 999px;
        font-weight: 700;
        background: #a33a2c;
    }

    .verdict.made {
        background: #2f7d4f;
    }

    .points {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        text-align: center;
    }

    .each {
        display: grid;
        grid-template-columns: repeat(var(--players), 1fr);
        gap: 12px;
        text-align: center;
    }

    .side {
        display: flex;
        flex-direction: column;
    }

    .who {
        font-size: 0.87em;
        opacity: 0.85;
    }

    .count {
        font-size: 2.4em;
        font-weight: 700;
        line-height: 1.1;
        color: #f2c94c;
    }

    .needed {
        display: flex;
        flex-direction: column;
        font-size: 0.87em;
        opacity: 0.85;
    }

    .stopped {
        justify-content: center;
        font-size: 0.87em;
        opacity: 0.85;
    }

    .bonuses {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.85em;
    }

    .bonuses li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
    }

    .given-up {
        text-align: center;
        opacity: 0.9;
    }

    .sheet {
        min-height: 0;
        overflow-y: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
    }

    th,
    td {
        padding: 3px 6px;
        text-align: left;
        white-space: nowrap;
    }

    thead th {
        position: sticky;
        top: 0;
        background: rgb(16 28 20);
        font-weight: 600;
    }

    th.score {
        border-bottom: 3px solid var(--seat);
    }

    .num {
        width: 2em;
        opacity: 0.7;
    }

    .loading {
        font-style: italic;
        opacity: 0.7;
    }

    .score {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .gain {
        color: #8fdcaa;
    }

    .loss {
        color: #f0a093;
    }

    .mark {
        margin-left: 4px;
        color: #f0a093;
    }

    .mark.made {
        color: #8fdcaa;
    }

    .latest {
        background: rgb(242 201 76 / 0.12);
    }

    tfoot td {
        border-top: 1px solid rgb(241 231 207 / 0.4);
        font-weight: 700;
    }
</style>
