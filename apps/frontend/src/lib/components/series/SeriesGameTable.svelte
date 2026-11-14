<script lang="ts">
    import { slide } from 'svelte/transition'
    import { SvelteSet } from 'svelte/reactivity'
    import { ChevronRightOutline } from 'flowbite-svelte-icons'
    import {
        GamePace,
        gamePaceOf,
        lastMoveAt,
        PlayerStatus,
        type Game,
        type GameCatalogEntry
    } from '@tabletop/common'
    import { GAME_PACE_LABELS } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import GameProgressBar from '$lib/components/GameProgressBar.svelte'
    import SeriesGameEntry from './SeriesGameEntry.svelte'
    import CopyGameLinkButton from '$lib/components/CopyGameLinkButton.svelte'
    import TurnWait from '$lib/components/TurnWait.svelte'
    import { minuteClock, timeSince } from '$lib/utils/clock.svelte'
    import { turnWaitDisplay } from '$lib/utils/gamePace'
    import { gameCardOptions } from '$lib/utils/gameOptions'
    import { recordedFinalScores } from '$lib/utils/gameScores'
    import { activePlayerText } from '$lib/utils/player'
    import {
        lobbyEntry,
        optionsSummary,
        panelPlayers,
        shortTitleName,
        takenSeats,
        winnerText
    } from '$lib/utils/seriesLobby'

    type Kind = 'open' | 'inProgress' | 'finished'

    let {
        kind,
        games,
        titlesById,
        label,
        highlightId
    }: {
        kind: Kind
        games: Game[]
        titlesById: Map<string, GameCatalogEntry>
        label: string
        highlightId?: string
    } = $props()
    const { authorizationService, libraryService } = getAppContext()
    const userId = $derived(authorizationService.getSessionUser()?.id)
    const panelIdPrefix = $props.id()
    const expanded = new SvelteSet<string>()

    type Heading = { area: string; label: string }

    const HEADINGS: Record<Kind, Heading[]> = {
        open: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Name' },
            { area: 'seats', label: 'Seats' },
            { area: 'options', label: 'Options' },
            { area: 'pace', label: 'Pace' },
            { area: 'age', label: 'Created' }
        ],
        inProgress: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Name' },
            { area: 'progress', label: 'Progress' },
            { area: 'options', label: 'Options' },
            { area: 'pace', label: 'Pace' },
            { area: 'onmove', label: 'Turn' },
            { area: 'age', label: 'Waiting' }
        ],
        finished: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Name' },
            { area: 'winner', label: 'Winner' },
            { area: 'options', label: 'Options' },
            { area: 'age', label: 'Finished' }
        ]
    }

    // Undefined until the title loads, so a game with options never shows as Standard.
    function options(game: Game) {
        const title = libraryService.getTitle(game.typeId)
        if (!title) return undefined
        return gameCardOptions(game.config ?? {}, title.info.configurator ?? [])
    }

    function age(game: Game): string {
        if (kind === 'open') return timeSince(game.createdAt)
        return timeSince(game.finishedAt ?? lastMoveAt(game))
    }

    function toggle(gameId: string) {
        if (expanded.has(gameId)) expanded.delete(gameId)
        else expanded.add(gameId)
    }

    function toggleFromRow(event: MouseEvent, gameId: string) {
        if (!(event.target instanceof Element) || event.target.closest('a, button')) return
        if (window.getSelection()?.toString()) return
        toggle(gameId)
    }
</script>

<div class="game-table {kind}" role="region" aria-label={label}>
    <div class="row heading" aria-hidden="true">
        {#each HEADINGS[kind] as heading (heading.area)}<span
                data-area={heading.area}
                style:grid-area={heading.area}>{heading.label}</span
            >{/each}
    </div>
    <ul>
        {#each games as game (game.id)}
            {@const title = titlesById.get(game.typeId)}
            {@const gameOptions = options(game)}
            {@const summary = gameOptions && optionsSummary(gameOptions)}
            {@const pace = gamePaceOf(game)}
            {@const onMove = kind === 'inProgress' ? activePlayerText(game, userId) : undefined}
            {@const isOpen = expanded.has(game.id)}
            {@const panelId = `${panelIdPrefix}-${game.id}`}
            <li class:highlight={game.id === highlightId} class:expanded={isOpen}>
                <!-- Clicking anywhere on the row is a pointer shortcut; keyboards and screen readers use the chevron button. -->
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div class="row" onclick={(event) => toggleFromRow(event, game.id)}>
                    <button
                        type="button"
                        class="chevron"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? panelId : undefined}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${game.name}`}
                        onclick={() => toggle(game.id)}
                        ><ChevronRightOutline class="h-3.5 w-3.5" aria-hidden="true" /></button
                    >
                    {#if title}<img class="cover" src={title.thumbnailUrl} alt="" />{/if}
                    <span class="name">{game.name}</span>
                    <span class="meta">
                        <span class="title">{title ? shortTitleName(title.metadata) : ''}</span>
                        {#if onMove}
                            <span class="onmove"
                                >{onMove}<span class="phone-only">{' to move'}</span></span
                            >
                        {:else if kind === 'finished'}
                            <span class="winner"
                                >{winnerText(game)}{#if game.winningPlayerIds.length > 0}<span
                                        class="phone-only">{' won'}</span
                                    >{/if}</span
                            >
                        {/if}
                        {#if kind !== 'finished'}<span
                                class="pace"
                                class:live={pace.pace === GamePace.Live}
                                >{GAME_PACE_LABELS[pace.pace].name}<span class="phone-only"
                                    >{' pace'}</span
                                ></span
                            >{/if}
                    </span>
                    {#if summary}<span class="options" class:standard={gameOptions?.length === 0}
                            >{summary}</span
                        >{/if}
                    {#if kind === 'inProgress'}
                        {@const wait = turnWaitDisplay(game, minuteClock.now)}
                        <span class="age" class:past={wait?.pastPace}
                            >{#if wait}<TurnWait {wait} label="Waiting"
                                    >{#snippet prefix()}<span class="phone-only">{'waiting '}</span
                                        >{/snippet}</TurnWait
                                >{/if}</span
                        >
                    {:else}
                        <span class="age">{age(game)}</span>
                    {/if}
                    {#if kind === 'open'}
                        <span
                            class="seats"
                            aria-label={`${takenSeats(game)} of ${game.players.length} seats taken`}
                        >
                            <span class="dots" aria-hidden="true"
                                >{#each game.players as player (player.id)}<i
                                        class:taken={player.status !== PlayerStatus.Open}
                                    ></i>{/each}</span
                            >{takenSeats(game)}/{game.players.length}
                        </span>
                    {/if}
                    {#if kind === 'inProgress' && game.progress}
                        <GameProgressBar progress={game.progress} class="progress" />
                    {/if}
                    <span class="action"
                        ><CopyGameLinkButton {game} namesGame /><SeriesGameEntry
                            {game}
                            entry={lobbyEntry(game, userId)}
                        /></span
                    >
                </div>
                {#if isOpen}
                    {@const scores = recordedFinalScores(game, title?.metadata)}
                    <div class="panel" id={panelId} transition:slide={{ duration: 150 }}>
                        <div class="panel-blocks">
                            {#if gameOptions && gameOptions.length > 0}
                                <section class="block" aria-label="Game options">
                                    <div class="block-heading"><span>GAME OPTIONS</span></div>
                                    <dl>
                                        {#each gameOptions as option (option.name)}<div
                                                class="line option"
                                            >
                                                <dt>{option.name}</dt>
                                                <dd>{option.value}</dd>
                                            </div>{/each}
                                    </dl>
                                </section>
                            {/if}
                            <section class="block" aria-label="Players">
                                <div class="block-heading">
                                    <span>PLAYERS</span>{#if scores}<span>SCORE</span>{/if}
                                </div>
                                <ul>
                                    {#each panelPlayers(game, scores) as player (player.id)}<li
                                            class="line player"
                                        >
                                            <span
                                                class:active={player.highlight === 'active'}
                                                class:won={player.highlight === 'winner'}
                                                >{player.name}</span
                                            >
                                            <span class="note">{player.note}</span>
                                        </li>{/each}
                                </ul>
                            </section>
                        </div>
                    </div>
                {/if}
            </li>
        {/each}
    </ul>
</div>

<style>
    .game-table {
        --pad-x: 10px;
        --gap: 14px;
        --chevron: 18px;
        --cover: 28px;
        --title: 7rem;
    }
    ul {
        display: grid;
    }
    .row {
        display: grid;
        align-items: center;
        column-gap: var(--gap);
        padding: 9px var(--pad-x);
        border-bottom: 1px solid var(--color-gray-800);
        font-size: 13px;
        color: var(--color-gray-400);
    }
    li > .row {
        cursor: pointer;
    }
    .heading {
        padding-top: 0;
        padding-bottom: 8px;
        border-bottom-color: var(--color-gray-700);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-gray-500);
    }
    li.highlight > .row,
    li.highlight > .panel {
        background: #1e3a8a33;
    }
    li:hover > .row,
    li.expanded > .row,
    li.expanded > .panel {
        background: #1f293766;
    }
    li.expanded > .row {
        border-bottom-color: transparent;
    }
    .chevron {
        grid-area: chevron;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        border-radius: 4px;
        color: var(--color-gray-500);
    }
    .chevron :global(svg) {
        transition: transform 150ms;
    }
    li.expanded .chevron {
        color: var(--color-gray-300);
    }
    li.expanded .chevron :global(svg) {
        transform: rotate(90deg);
    }
    .chevron:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 1px;
    }
    .cover {
        grid-area: cover;
        width: var(--cover);
        height: var(--cover);
        object-fit: contain;
    }
    .name {
        grid-area: name;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        color: var(--color-gray-200);
    }
    .meta {
        display: contents;
    }
    .meta > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .title {
        grid-area: title;
        color: var(--color-gray-300);
    }
    .pace {
        grid-area: pace;
    }
    .pace.live {
        color: var(--color-green-400);
    }
    .options {
        grid-area: options;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .options.standard {
        color: var(--color-gray-500);
    }
    .phone-only {
        display: none;
    }
    .onmove {
        grid-area: onmove;
        color: var(--color-orange-400);
    }
    .winner {
        grid-area: winner;
        color: var(--color-blue-400);
    }
    .age {
        grid-area: age;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-gray-500);
    }
    .age.past {
        color: var(--color-amber-400);
    }
    .seats {
        grid-area: seats;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .dots {
        display: inline-flex;
        gap: 3px;
    }
    .dots i {
        width: 9px;
        height: 9px;
        border: 1.5px solid var(--color-gray-500);
        border-radius: 50%;
    }
    .dots i.taken {
        border-color: var(--color-blue-400);
        background: var(--color-blue-400);
    }
    .row :global(.progress) {
        grid-area: progress;
    }
    .action {
        grid-area: action;
        justify-self: end;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .panel {
        padding: 2px var(--pad-x) 18px;
        border-bottom: 1px solid var(--color-gray-800);
        color: var(--color-gray-400);
    }
    .panel-blocks {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 18px 48px;
    }
    .block {
        width: 20rem;
        max-width: 100%;
    }
    .block-heading {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--color-gray-700);
        font-size: 12px;
        font-weight: 600;
    }
    .line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 2px 0;
    }
    .option {
        font-size: 12px;
    }
    .player {
        font-size: 14px;
    }
    .player .note {
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }
    .player .active {
        color: var(--color-orange-400);
    }
    .player .won {
        color: var(--color-blue-400);
    }
    @media (min-width: 641px) {
        .game-table {
            display: grid;
            column-gap: var(--gap);
        }
        .game-table > .heading,
        .game-table > ul,
        .game-table > ul > li,
        li > .row,
        li > .panel {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: subgrid;
        }
        .panel-blocks {
            grid-column: 4 / -1;
        }
        .open {
            grid-template-columns:
                var(--chevron) var(--cover) fit-content(var(--title)) minmax(8rem, 1fr)
                max-content fit-content(9rem) max-content max-content max-content;
        }
        .open .row {
            grid-template-areas: 'chevron cover title name seats options pace age action';
        }
        .inProgress {
            grid-template-columns:
                var(--chevron) var(--cover) fit-content(var(--title)) minmax(8rem, 1fr)
                minmax(11.5rem, 1fr) fit-content(9rem) max-content fit-content(7.5rem)
                max-content max-content;
        }
        .inProgress .row {
            grid-template-areas: 'chevron cover title name progress options pace onmove age action';
        }
        .finished {
            grid-template-columns:
                var(--chevron) var(--cover) fit-content(var(--title)) minmax(8rem, 1fr)
                fit-content(10rem) fit-content(9rem) max-content max-content;
        }
        .finished .row {
            grid-template-areas: 'chevron cover title name winner options age action';
        }
    }
    @media (min-width: 641px) and (max-width: 1199px) {
        .inProgress {
            grid-template-columns:
                var(--chevron) var(--cover) fit-content(var(--title)) minmax(8rem, 1fr)
                fit-content(9rem) max-content fit-content(7.5rem) max-content max-content;
        }
        .inProgress .row {
            grid-template-areas: 'chevron cover title name options pace onmove age action';
        }
        .inProgress .row :global(.progress),
        .inProgress [data-area='progress'] {
            display: none;
        }
    }
    @media (max-width: 640px) {
        .game-table {
            --pad-x: 2px;
            --gap: 12px;
            --chevron: 14px;
            --cover: 40px;
        }
        .heading {
            display: none;
        }
        .row {
            row-gap: 3px;
            padding-block: 11px;
        }
        .chevron {
            align-self: center;
        }
        .open .row {
            grid-template-columns: var(--chevron) var(--cover) minmax(0, 1fr) auto;
            grid-template-areas:
                'chevron cover name action' 'chevron cover meta seats'
                'chevron cover options age';
        }
        .inProgress .row {
            grid-template-columns: var(--chevron) var(--cover) minmax(0, 1fr) auto;
            grid-template-areas:
                'chevron cover name action' 'chevron cover meta meta'
                'chevron cover options age' 'chevron cover progress progress';
        }
        .finished .row {
            grid-template-columns: var(--chevron) var(--cover) minmax(0, 1fr) auto;
            grid-template-areas:
                'chevron cover name action' 'chevron cover meta meta'
                'chevron cover options age';
        }
        .cover {
            align-self: start;
        }
        .name {
            font-size: 15px;
        }
        .meta {
            grid-area: meta;
            display: block;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
        }
        .meta > span,
        .phone-only {
            display: inline;
        }
        .options,
        .age {
            font-size: 12px;
        }
        .age {
            justify-self: end;
        }
        .meta > span + span::before {
            content: ' · ';
            color: var(--color-gray-500);
        }
        .title {
            color: var(--color-blue-300);
        }
        .seats {
            justify-self: end;
            font-size: 11px;
        }
        .row :global(.progress) {
            margin-top: 3px;
        }
        .panel {
            padding-left: calc(var(--pad-x) + var(--chevron) + var(--cover) + 2 * var(--gap));
        }
        .panel-blocks {
            flex-direction: column;
        }
        .block {
            width: 100%;
        }
    }
</style>
