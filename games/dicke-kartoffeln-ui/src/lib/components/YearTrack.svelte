<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { upcomingRounds } from '$lib/utils/rounds.js'

    const gameSession = getGameSession()

    // Matches the breakpoint below at which the round names are hidden.
    const compactNames = new MediaQuery('(max-width: 639px)')
    const NAMED_ROUND_WIDTH = 84
    const NUMBERED_ROUND_WIDTH = 52
    const FEWEST_ROUNDS = 3
    let trackWidth = $state(0)
    const count = $derived(
        Math.max(
            FEWEST_ROUNDS,
            Math.floor(
                trackWidth / (compactNames.current ? NUMBERED_ROUND_WIDTH : NAMED_ROUND_WIDTH)
            )
        )
    )

    const focus = $derived(
        gameSession.pendingYearEnd?.phases[gameSession.yearEndStep].round ??
            gameSession.shownRound
    )
    const year = $derived(gameSession.pendingYearEnd?.year ?? gameSession.year)
    const rounds = $derived(upcomingRounds(focus, year < gameSession.setup.years, count))
</script>

<ol class="track" aria-label="The coming rounds of the year" bind:clientWidth={trackWidth}>
    {#each rounds as round (`${round.nextYear}-${round.number}`)}
        <li
            class:current={round.current}
            class:next-year={round.nextYear}
            title="{round.nextYear ? 'Next year: ' : ''}{round.number}. {round.name}"
        >
            <span class="number">{round.number}</span>
            <span class="name">{round.short}</span>
        </li>
    {/each}
</ol>

<style>
    .track {
        display: flex;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-family: 'Kartoffeln Typewriter', 'Courier New', monospace;
    }

    li {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        border-radius: 6px;
        background: rgba(255, 252, 240, 0.6);
        padding: 1px 2px;
        color: #8a7558;
        line-height: 1.05;
    }

    li.current {
        background: #6e3b1c;
        color: #fff6dc;
    }

    li.next-year {
        background: rgba(233, 220, 192, 0.6);
        color: #a8977a;
    }

    li.next-year:not(.next-year + .next-year) {
        margin-left: 6px;
        box-shadow: -4px 0 0 -2px #b8a580;
    }

    .number {
        font-size: 15px;
        font-weight: 700;
    }

    .name {
        overflow: hidden;
        max-width: 100%;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @media (max-width: 639px) {
        .name {
            display: none;
        }
    }
</style>
