<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { marks } from '$lib/utils/format.js'
    import { roundLabel } from '$lib/utils/rounds.js'
    import {
        YEAR_END_RULES,
        YearEndStatus,
        type YearEndPhase,
        type YearEndReport
    } from '$lib/utils/yearEnd.js'

    let {
        report,
        step,
        stepping = false
    }: { report: YearEndReport; step: number; stepping?: boolean } = $props()

    const gameSession = getGameSession()

    const focused = $derived(report.phases[step])
    const last = $derived(step === report.phases.length - 1)
    const players = $derived(gameSession.gameState.players)

    function shown(index: number, phase: YearEndPhase): boolean {
        return phase.status !== YearEndStatus.Pending && (!stepping || index <= step)
    }
</script>

<div class="report">
    <div class="title">
        {#if report.year !== undefined}Year {report.year} draws to a close{:else}The year draws to
            a close{/if}
    </div>
    <div class="scroll">
        <table>
            <thead>
                <tr>
                    <th class="farmer">Farmer</th>
                    {#each report.phases as phase, index (phase.round)}
                        {@const label = roundLabel(phase.round)}
                        <th class:focus={index === step}>
                            {#if stepping}
                                <button
                                    type="button"
                                    onclick={() => gameSession.showYearEndStep(index)}
                                    >{label?.number} · {label?.name}</button
                                >
                            {:else}
                                {label?.number} · {label?.name}
                            {/if}
                        </th>
                    {/each}
                    <th>Cash</th>
                </tr>
            </thead>
            <tbody>
                {#each players as player (player.playerId)}
                    <tr>
                        <td class="farmer"><PlayerName playerId={player.playerId} /></td>
                        {#each report.phases as phase, index (phase.round)}
                            {@const lines = phase.results[player.playerId] ?? []}
                            <td class:focus={index === step} class:muted={!shown(index, phase)}>
                                {#if !shown(index, phase)}
                                    …
                                {:else if lines.length === 0}
                                    —
                                {:else}
                                    {lines.join(' · ')}
                                {/if}
                            </td>
                        {/each}
                        <td class="cash">
                            {#if !stepping || last}
                                <div>{marks(player.cash)}</div>
                                {#if player.loans > 0}
                                    <div class="loans">
                                        {player.loans}
                                        {player.loans === 1 ? 'loan' : 'loans'}
                                    </div>
                                {/if}
                            {:else}
                                …
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    <p class="rule">
        {#if focused.status === YearEndStatus.Skipped}
            Nobody had compost on pile 2 to spread.
        {:else}
            {YEAR_END_RULES[focused.round]}
        {/if}
    </p>
    {#if stepping}
        <div class="nav">
            <button
                type="button"
                class="arrow"
                disabled={step === 0}
                aria-label="Previous round"
                onclick={() => gameSession.showYearEndStep(step - 1)}>‹</button
            >
            <span class="count">{step + 1} / {report.phases.length}</span>
            {#if last}
                <button type="button" class="go" onclick={() => gameSession.finishYearEnd()}
                    >Start year {(report.year ?? gameSession.year - 1) + 1}</button
                >
            {:else}
                <button
                    type="button"
                    class="arrow"
                    aria-label="Next round"
                    onclick={() => gameSession.showYearEndStep(step + 1)}>›</button
                >
                <button type="button" class="skip" onclick={() => gameSession.finishYearEnd()}
                    >skip</button
                >
            {/if}
        </div>
    {/if}
</div>

<style>
    .report {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 4px 10px 6px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        color: #3d2410;
    }

    .title {
        font-size: 18px;
        text-align: center;
    }

    .scroll {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        line-height: 1.15;
    }

    th,
    td {
        border: 1px solid #d4c19c;
        padding: 2px 6px;
        vertical-align: top;
        text-align: center;
    }

    th {
        background: #f1e6cb;
        color: #6e3b1c;
        font-weight: 400;
        white-space: nowrap;
    }

    th button {
        text-decoration: underline dotted;
    }

    .farmer {
        text-align: left;
        white-space: nowrap;
    }

    .focus {
        background: #fff1b8;
    }

    th.focus {
        background: #6e3b1c;
        color: #fff6dc;
    }

    .muted {
        color: #b8a580;
    }

    .cash {
        white-space: nowrap;
    }

    .loans {
        color: #8a1d1d;
        font-size: 12px;
    }

    .rule {
        margin: 0;
        color: #5a4026;
        font-size: 15px;
        line-height: 1.2;
    }

    .nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .arrow {
        width: 30px;
        height: 26px;
        border: 2px solid #6e3b1c;
        border-radius: 999px;
        color: #6e3b1c;
        font-size: 20px;
        line-height: 1;
    }

    .arrow:disabled {
        opacity: 0.3;
    }

    .count {
        color: #8a7558;
        font-size: 14px;
    }

    .go {
        border-radius: 999px;
        background: #6e3b1c;
        padding: 2px 16px;
        color: #fff6dc;
        font-size: 17px;
    }

    .go:hover {
        background: #8a4b25;
    }

    .skip {
        color: #8a7558;
        font-size: 14px;
        text-decoration: underline;
    }

    @media (max-width: 639px) {
        table {
            font-size: 12px;
        }

        .rule {
            font-size: 13px;
        }
    }
</style>
