<script lang="ts">
    import { slide } from 'svelte/transition'
    import { SvelteSet } from 'svelte/reactivity'
    import { ChevronRightOutline } from 'flowbite-svelte-icons'
    import { lastMoveAt, PlayerStatus, type Game, type GameCatalogEntry } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import GameProgressBar from '$lib/components/GameProgressBar.svelte'
    import SeriesGameEntry from './SeriesGameEntry.svelte'
    import { timeSince } from '$lib/utils/clock.svelte'
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
            { area: 'age', label: 'Created' }
        ],
        inProgress: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Name' },
            { area: 'progress', label: 'Progress' },
            { area: 'options', label: 'Options' },
            { area: 'onmove', label: 'Turn' },
            { area: 'age', label: 'Last move' }
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
        if (kind === 'inProgress') return timeSince(lastMoveAt(game))
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
        {#each HEADINGS[kind] as heading (heading.area)}<span style:grid-area={heading.area}
                >{heading.label}</span
            >{/each}
    </div>
    <ul>
        {#each games as game (game.id)}
            {@const title = titlesById.get(game.typeId)}
            {@const gameOptions = options(game)}
            {@const summary = gameOptions && optionsSummary(gameOptions)}
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
                        {#if summary}<span
                                class="options"
                                class:standard={gameOptions?.length === 0}>{summary}</span
                            >{/if}
                        <span class="age">{age(game)}</span>
                    </span>
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
                        ><SeriesGameEntry {game} entry={lobbyEntry(game, userId)} /></span
                    >
                </div>
                {#if isOpen}
                    {@const scores = recordedFinalScores(game, title?.metadata)}
                    <div class="panel" id={panelId} transition:slide={{ duration: 150 }}>
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
                {/if}
            </li>
        {/each}
    </ul>
</div>

<style>
    .game-table {
        --pad-x: 10px;
        --gap: 16px;
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
    .open .row {
        grid-template-columns:
            var(--chevron) var(--cover) var(--title) minmax(0, 1fr) 8.5rem minmax(0, 9rem)
            7rem 5.5rem;
        grid-template-areas: 'chevron cover title name seats options age action';
    }
    .inProgress .row {
        grid-template-columns:
            var(--chevron) var(--cover) var(--title) minmax(0, 1fr) minmax(10rem, 1.1fr)
            minmax(0, 8rem) minmax(0, 8rem) 7rem 6rem;
        grid-template-areas: 'chevron cover title name progress options onmove age action';
    }
    .finished .row {
        grid-template-columns:
            var(--chevron) var(--cover) var(--title) minmax(0, 1fr) minmax(0, 10rem)
            minmax(0, 9rem) 7rem 5.5rem;
        grid-template-areas: 'chevron cover title name winner options age action';
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
    .options {
        grid-area: options;
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
        color: var(--color-gray-500);
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
    }
    .panel {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 18px 48px;
        padding: 2px var(--pad-x) 18px
            calc(var(--pad-x) + var(--chevron) + var(--cover) + var(--title) + 3 * var(--gap));
        border-bottom: 1px solid var(--color-gray-800);
        color: var(--color-gray-400);
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
            grid-template-areas: 'chevron cover name action' 'chevron cover meta seats';
        }
        .inProgress .row {
            grid-template-columns: var(--chevron) var(--cover) minmax(0, 1fr) auto;
            grid-template-areas:
                'chevron cover name action' 'chevron cover meta meta'
                'chevron cover progress progress';
        }
        .finished .row {
            grid-template-columns: var(--chevron) var(--cover) minmax(0, 1fr) auto;
            grid-template-areas: 'chevron cover name action' 'chevron cover meta meta';
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
            flex-direction: column;
            padding-left: calc(var(--pad-x) + var(--chevron) + var(--cover) + 2 * var(--gap));
        }
        .block {
            width: 100%;
        }
    }
</style>
