<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { availableCatalogEntries } from '$lib/utils/libraryTitles'
    import { getLoginModal } from '$lib/stores/loginModal'
    import { ArrowRightOutline, ArrowDownOutline, UsersOutline } from 'flowbite-svelte-icons'

    let { signedIn = false, scrollTop = $bindable(0) }: { signedIn?: boolean; scrollTop?: number } =
        $props()
    const { catalogService, authorizationService } = getAppContext()
    const openLoginModal = getLoginModal()
    void catalogService.whenReady()
    let titles = $derived(
        availableCatalogEntries(
            catalogService.entries,
            signedIn ? authorizationService.getSessionUser() : undefined
        )
    )
    let showAllGames = $state(false)
    const shelfSize = 10
    let shelfTitles = $derived(signedIn || showAllGames ? titles : titles.slice(0, shelfSize))
    const featuredIds = ['bus', 'indonesia', 'sol']
    let featuredTitles = $derived(
        featuredIds.flatMap((id) => titles.filter((title) => title.id === id))
    )
</script>

<main class="landing collection-page" class:signed-in={signedIn}>
    {#if !signedIn}
        <section class="hero" aria-labelledby="welcome-heading">
            <div class="introduction">
                <h1 id="welcome-heading">Care to play<br />a <span>game?</span></h1>
                <p class="intro-copy">
                    Bring your friends.<br />Take your turns at your own pace.
                </p>
                <div class="actions">
                    <button class="primary-action" onclick={openLoginModal}>
                        Take a seat <ArrowRightOutline class="h-5 w-5" />
                    </button>
                    <a class="browse-action" href="#games">
                        Explore the games <ArrowDownOutline class="h-4 w-4" />
                    </a>
                </div>
                <p class="small-print"><strong>Always</strong> free to play. Fully open source.</p>
            </div>

            <div class="showcase" aria-hidden="true">
                <div class="table-ring"></div>
                {#each featuredTitles as title (title.id)}
                    <div class="featured-cover" data-game={title.id}>
                        <img src={title.thumbnailUrl} alt="" fetchpriority="high" />
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <section
        id="games"
        class="games"
        aria-labelledby="games-heading"
        aria-busy={catalogService.loading}
    >
        <div class="collection-content">
            <div class="section-heading collection-header">
                <div>
                    <svelte:element
                        this={signedIn ? 'h1' : 'h2'}
                        id="games-heading"
                        class="collection-heading"
                    >
                        {signedIn ? 'What would you like to play?' : 'Find your next game.'}
                    </svelte:element>
                </div>
                {#if !catalogService.loading && titles.length > 0}
                    <span class="library-note" aria-live="polite"
                        >{titles.length}
                        {titles.length === 1 ? 'game' : 'games'}
                        in the library</span
                    >
                {/if}
            </div>

            <div
                class="library-results"
                onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
                {@attach (element) => {
                    element.scrollTop = scrollTop
                }}
            >
                {#if catalogService.loading}
                    <p role="status" class="library-status">Setting out the games…</p>
                {:else if titles.length === 0}
                    <p role="status" class="library-status">
                        The game shelf couldn’t load. Please refresh to try again.
                    </p>
                {:else}
                    <ul id="game-shelf" class="game-shelf">
                        {#each shelfTitles as title (title.id)}
                            <li>
                                {#snippet cover()}
                                    <div class="cover-stage">
                                        <img
                                            src={title.thumbnailUrl}
                                            alt=""
                                            loading="lazy"
                                            data-game-cover={title.id}
                                        />
                                        <span class="play-arrow"
                                            ><ArrowRightOutline class="h-5 w-5" /></span
                                        >
                                    </div>
                                    <h3>{title.metadata.name}</h3>
                                    <p class="player-count">
                                        <UsersOutline class="h-3.5 w-3.5" />
                                        {title.metadata
                                            .minPlayers}{#if title.metadata.maxPlayers !== title.metadata.minPlayers}–{title
                                                .metadata.maxPlayers}{/if} players
                                    </p>
                                {/snippet}
                                {#if signedIn}
                                    <a
                                        class="game"
                                        href={`/library/${title.id}`}
                                        aria-label={`View ${title.metadata.name}`}
                                    >
                                        {@render cover()}
                                    </a>
                                {:else}
                                    <button
                                        class="game"
                                        onclick={openLoginModal}
                                        aria-label={`Sign in to play ${title.metadata.name}`}
                                    >
                                        {@render cover()}
                                    </button>
                                {/if}
                            </li>
                        {/each}
                    </ul>
                    {#if !signedIn && titles.length > shelfSize}
                        <button
                            class="expand-shelf"
                            aria-expanded={showAllGames}
                            aria-controls="game-shelf"
                            onclick={() => (showAllGames = !showAllGames)}
                        >
                            {showAllGames ? 'Show fewer games' : `See all ${titles.length} games`}
                            <ArrowDownOutline
                                class={showAllGames ? 'h-4 w-4 rotate-180' : 'h-4 w-4'}
                            />
                        </button>
                    {/if}
                {/if}
            </div>
        </div>
    </section>
</main>

<style>
    @media (prefers-reduced-motion: no-preference) {
        :global(html:has(.landing)) {
            scroll-behavior: smooth;
        }
    }

    .landing {
        color: var(--color-gray-200);
    }
    .landing:not(.signed-in) {
        padding-top: 0;
    }

    .hero {
        font-family: 'Inter', sans-serif;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        gap: 24px;
        padding: 32px 40px 12px 0;
    }

    .hero h1 {
        margin: 20px 0 32px;
        font-size: clamp(48px, 5.6vw, 76px);
        font-weight: 750;
        letter-spacing: -0.02em;
        line-height: 1.04;
    }

    .hero h1 span {
        color: #6496df;
    }

    .intro-copy {
        color: var(--color-gray-400);
        font-size: 16px;
        line-height: 1.7;
    }

    .actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 24px;
        margin-top: 28px;
    }

    .primary-action,
    .browse-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 48px;
        font-size: 14px;
        font-weight: 600;
    }

    @media (min-width: 701px) and (max-width: 1000px) {
        .browse-action {
            display: none;
        }
    }

    .primary-action {
        cursor: pointer;
        padding: 0 22px;
        border: 1px solid var(--color-blue-500);
        border-radius: 8px;
        background: var(--color-blue-600);
        color: white;
        box-shadow: 0 5px 24px #2563eb20;
    }

    .primary-action:hover {
        background: var(--color-blue-700);
    }

    .browse-action:hover {
        color: var(--color-blue-300);
    }

    a:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 6px;
        border-radius: 6px;
    }

    .small-print {
        margin-top: 32px;
        color: var(--color-gray-400);
        font-size: 11px;
    }

    .showcase {
        position: relative;
        height: 370px;
        isolation: isolate;
    }

    .showcase::before {
        content: '';
        position: absolute;
        inset: -40px -20px;
        background: radial-gradient(ellipse, #427ac725, transparent 68%);
        z-index: -1;
    }

    .table-ring {
        position: absolute;
        inset: 16px 10%;
        border: 1px solid #427ac726;
        border-radius: 50%;
        transform: rotate(-20deg);
    }

    .table-ring::after {
        content: '';
        position: absolute;
        inset: 24px -20px;
        border: 1px solid #427ac714;
        border-radius: 50%;
    }

    .featured-cover {
        position: absolute;
        width: 43%;
        top: 23%;
        filter: drop-shadow(0 20px 18px #0009);
    }

    .featured-cover img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 5px;
        border: 1px solid #ffffff26;
    }

    .featured-cover[data-game='bus'] {
        left: 1%;
        transform: rotate(-16deg);
    }

    .featured-cover[data-game='indonesia'] {
        left: 29%;
        top: 10%;
        z-index: 2;
        transform: rotate(3deg);
    }

    .featured-cover[data-game='sol'] {
        right: -1%;
        top: 39%;
        z-index: 3;
        transform: rotate(17deg);
    }

    .collection-content {
        view-transition-name: game-collection;
    }
    .games {
        padding-top: 32px;
        padding-bottom: 48px;
        border-top: 1px solid var(--color-gray-700);
        scroll-margin-top: 24px;
    }

    .landing.signed-in {
        height: calc(100dvh - var(--app-navbar-height, 0px) - var(--app-banner-height, 0px));
    }
    .signed-in .games {
        display: flex;
        flex-direction: column;
        height: 100%;
        border-top: 0;
        padding-top: 0;
        padding-bottom: 0;
    }
    .signed-in .collection-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }
    .signed-in .library-results {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        margin: -4px -16px 0 -4px;
        padding: 4px 16px 48px 4px;
    }
    .section-heading {
        flex-shrink: 0;
        padding-bottom: 8px;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
    }
    .library-note {
        text-align: right;
        flex-shrink: 0;
        padding-bottom: 4px;
        color: var(--color-gray-400);
        font-size: 13px;
    }

    .game-shelf {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 30px 20px;
    }

    .game {
        display: block;
        width: 100%;
        text-align: left;
        cursor: pointer;
    }

    .cover-stage {
        position: relative;
        isolation: isolate;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 186px;
        padding: 16px;
        border: 1px solid #ffffff0a;
        border-radius: 10px;
        background: linear-gradient(145deg, #263244, var(--color-gray-800));
        transition: border-color 250ms ease;
    }

    .cover-stage::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: #293950;
        opacity: 0;
        transition: opacity 250ms ease;
    }

    .cover-stage img {
        max-width: 100%;
        max-height: 100%;
        height: auto;
        border-radius: 5px;
        object-fit: contain;
        filter: drop-shadow(0 8px 6px #0006);
        transition: transform 180ms;
    }

    .play-arrow {
        position: absolute;
        bottom: 10px;
        right: 10px;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--color-blue-600);
        color: white;
        opacity: 0;
        transition: opacity 180ms;
    }

    .game:hover .cover-stage,
    .game:focus-visible .cover-stage {
        border-color: var(--color-highlight-border);
    }

    .game:hover .cover-stage::before,
    .game:focus-visible .cover-stage::before {
        opacity: 1;
    }

    .game:hover img,
    .game:focus-visible img {
        transform: translateY(-4px) rotate(-2deg);
    }

    .game:hover .play-arrow,
    .game:focus-visible .play-arrow {
        opacity: 1;
    }

    h3 {
        margin-top: 12px;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
    }

    .player-count {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 5px;
        color: var(--color-gray-400);
        font-size: 12px;
    }

    .library-status {
        padding: 48px 0;
        color: var(--color-gray-400);
    }

    .expand-shelf {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 48px;
        margin: 32px auto 0;
        padding: 0 22px;
        border: 1px solid var(--color-gray-600);
        border-radius: 8px;
        color: var(--color-gray-200);
        font-size: 14px;
        cursor: pointer;
    }

    .expand-shelf:hover {
        background: var(--color-gray-800);
        border-color: var(--color-blue-400);
    }

    @media (max-width: 1000px) {
        .showcase {
            height: 300px;
        }
        .actions {
            gap: 16px;
        }
        .game-shelf {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .cover-stage {
            height: 210px;
        }
    }

    @media (max-width: 700px) {
        .hero {
            grid-template-columns: 1fr;
            padding-right: 0;
            gap: 12px;
        }
        .introduction {
            text-align: center;
        }
        .hero h1 {
            font-size: clamp(42px, 11.5vw, 60px);
        }
        .intro-copy {
            font-size: 15px;
        }
        .actions {
            justify-content: center;
            gap: 10px 20px;
            margin-top: 24px;
        }
        .small-print {
            font-size: 10px;
        }
        .showcase {
            display: none;
        }
        .section-heading {
            align-items: start;
        }
        .library-note {
            max-width: 96px;
        }
        .game-shelf {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px 16px;
        }
        .cover-stage {
            height: clamp(142px, 40vw, 230px);
            padding: 12px;
        }
        h3 {
            font-size: 14px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .cover-stage,
        .cover-stage::before,
        .cover-stage img,
        .play-arrow {
            transition: none;
        }
        .game:hover img,
        .game:focus-visible img {
            transform: none;
        }
    }
</style>
