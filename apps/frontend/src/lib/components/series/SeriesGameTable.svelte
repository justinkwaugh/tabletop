<script lang="ts">
    import { lastMoveAt, PlayerStatus, type Game, type GameCatalogEntry } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import GameProgressBar from '$lib/components/GameProgressBar.svelte'
    import SeriesGameEntry from './SeriesGameEntry.svelte'
    import { timeSince } from '$lib/utils/clock.svelte'
    import { gameOptionsSummary } from '$lib/utils/gameOptions'
    import { activePlayerText } from '$lib/utils/player'
    import {
        hostName,
        lobbyEntry,
        shortTitleName,
        takenSeats,
        winnerText
    } from '$lib/utils/seriesLobby'

    type Kind = 'open' | 'inProgress' | 'finished'

    let {
        kind,
        games,
        titlesById,
        label
    }: {
        kind: Kind
        games: Game[]
        titlesById: Map<string, GameCatalogEntry>
        label: string
    } = $props()
    const { authorizationService, libraryService } = getAppContext()
    const userId = $derived(authorizationService.getSessionUser()?.id)

    type Heading = { area: string; label: string }

    const HEADINGS: Record<Kind, Heading[]> = {
        open: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Table' },
            { area: 'seats', label: 'Seats' },
            { area: 'options', label: 'Options' },
            { area: 'host', label: 'Host' },
            { area: 'age', label: 'Created' }
        ],
        inProgress: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Game' },
            { area: 'players', label: 'Players' },
            { area: 'progress', label: 'Progress' },
            { area: 'onmove', label: 'On move' },
            { area: 'age', label: 'Last move' }
        ],
        finished: [
            { area: 'title', label: 'Title' },
            { area: 'name', label: 'Game' },
            { area: 'players', label: 'Players' },
            { area: 'winner', label: 'Winner' },
            { area: 'age', label: 'Finished' }
        ]
    }

    function options(game: Game): string {
        const configurator = libraryService.getTitle(game.typeId)?.info.configurator
        return (configurator && gameOptionsSummary(game.config ?? {}, configurator)) || 'Standard'
    }

    function age(game: Game): string {
        if (kind === 'open') return timeSince(game.createdAt)
        if (kind === 'inProgress') return timeSince(lastMoveAt(game))
        return timeSince(game.finishedAt ?? lastMoveAt(game))
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
            <li class="row">
                {#if title}<img class="cover" src={title.thumbnailUrl} alt="" />{/if}
                <span class="name">{game.name}</span>
                <span class="meta">
                    <span class="title">{title ? shortTitleName(title.metadata) : ''}</span>
                    {#if kind === 'open'}
                        <span class="options">{options(game)}</span>
                        <span class="host">{hostName(game)}</span>
                    {:else if kind === 'inProgress'}
                        <span class="onmove">{activePlayerText(game, userId)}</span>
                    {:else}
                        <span class="winner">{winnerText(game)}</span>
                    {/if}
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
                {:else}
                    <span class="players">{game.players.length}</span>
                {/if}
                {#if kind === 'inProgress' && game.progress}
                    <GameProgressBar progress={game.progress} class="progress" />
                {/if}
                <span class="action"
                    ><SeriesGameEntry {game} entry={lobbyEntry(game, userId)} /></span
                >
            </li>
        {/each}
    </ul>
</div>

<style>
    ul {
        display: grid;
    }
    .row {
        display: grid;
        align-items: center;
        column-gap: 16px;
        padding: 9px 10px;
        border-bottom: 1px solid var(--color-gray-800);
        font-size: 13px;
        color: var(--color-gray-400);
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
    li.row:hover {
        background: #1f293766;
    }
    .open .row {
        grid-template-columns:
            28px 7rem minmax(0, 1.3fr) 8.5rem minmax(0, 1fr) minmax(0, 7rem)
            7rem 5.5rem;
        grid-template-areas: 'cover title name seats options host age action';
    }
    .open .heading {
        grid-template-areas: '. title name seats options host age action';
    }
    .inProgress .row {
        grid-template-columns:
            28px 7rem minmax(0, 1fr) 3.5rem minmax(10rem, 1.1fr) minmax(0, 8rem)
            7rem 6rem;
        grid-template-areas: 'cover title name players progress onmove age action';
    }
    .inProgress .heading {
        grid-template-areas: '. title name players progress onmove age action';
    }
    .finished .row {
        grid-template-columns: 28px 7rem minmax(0, 1fr) 3.5rem minmax(0, 1fr) 7rem 5.5rem;
        grid-template-areas: 'cover title name players winner age action';
    }
    .finished .heading {
        grid-template-areas: '. title name players winner age action';
    }
    .cover {
        grid-area: cover;
        width: 28px;
        height: 28px;
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
    .host {
        grid-area: host;
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
    .players {
        grid-area: players;
    }
    .row :global(.progress) {
        grid-area: progress;
    }
    .action {
        grid-area: action;
        justify-self: end;
    }
    @media (max-width: 640px) {
        .heading {
            display: none;
        }
        .row {
            column-gap: 12px;
            row-gap: 3px;
            padding: 11px 2px;
        }
        .open .row {
            grid-template-columns: 40px minmax(0, 1fr) auto;
            grid-template-areas: 'cover name action' 'cover meta seats';
        }
        .inProgress .row {
            grid-template-columns: 40px minmax(0, 1fr) auto;
            grid-template-areas: 'cover name action' 'cover meta meta' 'cover progress progress';
        }
        .finished .row {
            grid-template-columns: 40px minmax(0, 1fr) auto;
            grid-template-areas: 'cover name action' 'cover meta meta';
        }
        .cover {
            width: 40px;
            height: 40px;
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
        .meta > span {
            display: inline;
        }
        .meta > span + span::before {
            content: ' · ';
            color: var(--color-gray-500);
        }
        .title {
            color: var(--color-blue-300);
        }
        .players {
            display: none;
        }
        .seats {
            justify-self: end;
            font-size: 11px;
        }
        .row :global(.progress) {
            margin-top: 3px;
        }
    }
</style>
