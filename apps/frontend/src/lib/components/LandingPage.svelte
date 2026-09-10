<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { availableLibraryTitles } from '$lib/utils/libraryTitles'
    import { getLoginModal } from '$lib/stores/loginModal'
    import { ArrowRightOutline, ArrowDownOutline, UsersOutline } from 'flowbite-svelte-icons'

    const { libraryService } = getAppContext()
    const openLoginModal = getLoginModal()
    let titles = $derived(availableLibraryTitles(libraryService.titlesById))
    let showAllGames = $state(false)
    const shelfSize = 10
    let shelfTitles = $derived(showAllGames ? titles : titles.slice(0, shelfSize))
    const featuredIds = ['bus', 'indonesia', 'sol']
    let featuredTitles = $derived(
        featuredIds.flatMap((id) => titles.filter((title) => title.info.id === id))
    )
</script>

<main class="landing">
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
            {#each featuredTitles as title (title.info.id)}
                <div class="featured-cover" data-game={title.info.id}>
                    <img src={title.info.thumbnailUrl} alt="" fetchpriority="high" />
                </div>
            {/each}
        </div>
    </section>

    <section
        id="games"
        class="games"
        aria-labelledby="games-heading"
        aria-busy={libraryService.loading}
    >
        <div class="section-heading">
            <div>
                <p class="eyebrow">In the library</p>
                <h2 id="games-heading">Find your next game.</h2>
            </div>
            {#if !libraryService.loading && titles.length > 0}
                <span class="library-note">{titles.length} games to explore</span>
            {/if}
        </div>

        {#if libraryService.loading}
            <p role="status" class="library-status">Setting out the games…</p>
        {:else if titles.length === 0}
            <p role="status" class="library-status">
                The game shelf couldn’t load. Please refresh to try again.
            </p>
        {:else}
            <ul id="game-shelf" class="game-shelf">
                {#each shelfTitles as title (title.info.id)}
                    <li>
                        <button
                            class="game"
                            onclick={openLoginModal}
                            aria-label={`Sign in to play ${title.info.metadata.name}`}
                        >
                            <div class="cover-stage">
                                <img src={title.info.thumbnailUrl} alt="" loading="lazy" />
                                <span class="play-arrow"><ArrowRightOutline class="h-5 w-5" /></span
                                >
                            </div>
                            <h3>{title.info.metadata.name}</h3>
                            <p class="player-count">
                                <UsersOutline class="h-3.5 w-3.5" />
                                {title.info.metadata
                                    .minPlayers}{#if title.info.metadata.maxPlayers !== title.info.metadata.minPlayers}–{title
                                        .info.metadata.maxPlayers}{/if} players
                            </p>
                        </button>
                    </li>
                {/each}
            </ul>
            {#if titles.length > shelfSize}
                <button
                    class="expand-shelf"
                    aria-expanded={showAllGames}
                    aria-controls="game-shelf"
                    onclick={() => (showAllGames = !showAllGames)}
                >
                    {showAllGames ? 'Show fewer games' : `See all ${titles.length} games`}
                    <ArrowDownOutline class={showAllGames ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
                </button>
            {/if}
        {/if}
    </section>
</main>

<style>
    @media (prefers-reduced-motion: no-preference) {
        :global(html:has(.landing)) {
            scroll-behavior: smooth;
        }
    }

    .landing {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 48px;
        color: var(--color-gray-200);
    }

    .hero {
        font-family: 'Inter', sans-serif;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        gap: 24px;
        padding: 32px 40px 12px 0;
    }

    .eyebrow {
        color: var(--color-blue-300);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    h1 {
        margin: 20px 0 32px;
        font-size: clamp(48px, 5.6vw, 76px);
        font-weight: 750;
        letter-spacing: -0.02em;
        line-height: 1.04;
    }

    h1 span {
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

    .games {
        padding-top: 32px;
        padding-bottom: 48px;
        border-top: 1px solid var(--color-gray-700);
        scroll-margin-top: 24px;
    }

    .section-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 28px;
    }

    h2 {
        font-family: 'Inter', sans-serif;
        margin-top: 8px;
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.035em;
    }

    .library-note {
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
        .landing {
            padding: 0 32px;
        }
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
        .landing {
            padding: 0 24px;
        }
        .hero {
            grid-template-columns: 1fr;
            padding-right: 0;
            gap: 12px;
        }
        .introduction {
            text-align: center;
        }
        h1 {
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
            margin-bottom: 24px;
        }
        .library-note {
            display: none;
        }
        h2 {
            font-size: 26px;
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
