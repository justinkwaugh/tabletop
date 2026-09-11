<script lang="ts">
    import { goto } from '$app/navigation'
    import { GameEditForm, type GameUiDefinition } from '@tabletop/frontend-components'
    import {
        GameStorage,
        type Game,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import { Modal } from 'flowbite-svelte'
    import { ArrowLeftOutline, ArrowRightOutline, UsersOutline } from 'flowbite-svelte-icons'
    import TitleGames from '$lib/components/TitleGames.svelte'
    import TitleTournaments from '$lib/components/TitleTournaments.svelte'

    let { title }: { title: GameUiDefinition<GameState, HydratedGameState> } = $props()
    let creating = $state(false)
    let created = $state(false)
    let gamesSection: ReturnType<typeof TitleGames> | undefined = $state()
    const metadata = $derived(title.info.metadata)
    const paragraphs = $derived(metadata.description.split('\n').filter((line) => line.trim()))

    async function onGameCreated(game: Game) {
        creating = false
        if (game.storage === GameStorage.Local) {
            await goto(`/game/${game.id}`)
        } else {
            created = true
            await gamesSection?.refresh()
        }
    }
</script>

<svelte:head><title>{metadata.name} — Board Together</title></svelte:head>

<main class="title-page collection-page">
    <a class="back-link" href="/library"><ArrowLeftOutline class="h-4 w-4" /> All games</a>
    <section class="title-intro" aria-labelledby="title-heading">
        <div class="title-cover">
            <img
                src={title.info.thumbnailUrl}
                alt={`${metadata.name} box cover`}
                fetchpriority="high"
                data-game-cover={title.info.id}
            />
        </div>
        <div class="title-copy">
            <div class="facts">
                <span
                    ><UsersOutline class="h-4 w-4" />
                    {metadata.minPlayers}{#if metadata.maxPlayers !== metadata.minPlayers}–{metadata.maxPlayers}{/if}
                    players</span
                ><span>{metadata.year}</span>{#if metadata.beta}<span class="beta">Beta</span>{/if}
            </div>
            <h1 id="title-heading">{metadata.name}</h1>
            <p class="designer">Designed by <span>{metadata.designer}</span></p>
            <div class="description">
                {#each paragraphs as paragraph, index (index)}<p>{paragraph}</p>{/each}
            </div>
            <button class="start-game" onclick={() => (creating = true)}
                >Start a game <ArrowRightOutline class="h-4 w-4" /></button
            >
        </div>
    </section>
    {#if created}<p class="created" role="status">
            Game created. You’ll find it in your games below.
        </p>{/if}
    <div class="activity">
        <TitleGames
            bind:this={gamesSection}
            titleId={title.info.id}
            oncreate={() => (creating = true)}
        />
        <TitleTournaments titleId={title.info.id} />
    </div>
</main>

<Modal
    bind:open={creating}
    title="Start a game"
    size="xs"
    outsideclose
    class="backdrop:bg-black/70 dark:bg-gray-900 border border-highlight-border dark:border-highlight-border divide-y-0"
    classes={{ header: "font-['Inter'] text-2xl" }}
>
    <GameEditForm {title} oncancel={() => (creating = false)} onsave={onGameCreated} />
</Modal>

<style>
    .title-page {
        padding-bottom: 64px;
        color: var(--color-gray-200);
    }
    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .back-link:hover {
        color: var(--color-blue-300);
    }
    .title-intro {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr);
        align-items: center;
        gap: 56px;
        padding: 16px 0 44px;
        border-bottom: 1px solid var(--color-gray-800);
    }
    .title-cover {
        --cover-height: 390px;
        display: flex;
        justify-content: center;
        align-items: center;
        height: var(--cover-height);
    }
    .title-cover img {
        max-width: 100%;
        max-height: var(--cover-height);
        border-radius: 5px;
        object-fit: contain;
        filter: drop-shadow(0 16px 18px #0005);
    }
    .title-copy {
        min-width: 0;
    }
    .facts {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 20px;
        font-size: 13px;
        color: var(--color-blue-300);
    }
    .facts span {
        display: inline-flex;
        align-items: center;
        gap: 7px;
    }
    .facts .beta {
        color: var(--color-orange-300);
    }
    h1 {
        margin-top: 14px;
        font-family: 'Inter', sans-serif;
        font-size: clamp(32px, 3.5vw, 48px);
        font-weight: 650;
        line-height: 1.12;
        letter-spacing: -0.035em;
        overflow-wrap: anywhere;
    }
    .designer {
        margin-top: 12px;
        font-size: 14px;
        color: var(--color-gray-400);
    }
    .designer span {
        color: var(--color-gray-300);
    }
    .description {
        margin-top: 24px;
        color: var(--color-gray-300);
        font-size: 15px;
        line-height: 1.7;
    }
    .description p + p {
        margin-top: 12px;
    }
    .start-game {
        display: inline-flex;
        align-items: center;
        gap: 18px;
        min-height: 48px;
        margin-top: 28px;
        padding: 0 22px;
        background: var(--color-blue-600);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: background-color 200ms;
    }
    .start-game:hover {
        background: var(--color-blue-700);
    }
    a:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 4px;
    }
    .activity {
        display: grid;
        gap: 44px;
        padding-top: 36px;
    }
    .created {
        margin-top: 24px;
        color: var(--color-blue-300);
        font-size: 14px;
    }
    @media (max-width: 1000px) {
        .title-intro {
            gap: 32px;
        }
        .title-cover {
            --cover-height: 340px;
        }
    }
    @media (max-width: 700px) {
        .title-page {
            padding-bottom: 48px;
        }
        .title-intro {
            grid-template-columns: 1fr;
            gap: 28px;
            padding-top: 16px;
        }
        .title-cover {
            --cover-height: 280px;
        }
        h1 {
            font-size: 34px;
        }
        .description {
            font-size: 15px;
        }
    }
</style>
