<script lang="ts">
    import { ArrowRightOutline, DiscordSolid, GithubSolid } from 'flowbite-svelte-icons'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { authorizationService } = getAppContext()
    const libraryUrl = $derived(authorizationService.getSessionUser() ? '/library' : '/#games')
</script>

<svelte:head>
    <title>About us — Board Together</title>
    <meta
        name="description"
        content="Board Together is a free, open source place to play board games online with friends. Join the conversation or help build the next game."
    />
</svelte:head>

<main class="about-page collection-page">
    <header class="page-heading collection-header">
        <h1 class="collection-heading">About us</h1>
        <a class="library-link" href={libraryUrl}>
            Go to the library <ArrowRightOutline class="h-4 w-4" />
        </a>
    </header>

    <div class="introduction">
        <div class="intro-copy">
            <p class="lead">
                <span class="whitespace-nowrap font-sans tracking-normal"
                    ><span class="font-bold text-[#427ac7]">Board</span><span
                        class="font-light text-gray-300">Together</span
                    ></span
                >
                is a place to play board games online with friends.
            </p>
            <p class="welcome">
                We hope you’ve been enjoying your games here. If you have feedback, we’d love to
                hear it.
            </p>
        </div>
        <ul class="principles" aria-label="The project">
            <li><strong>Always</strong> free to play.</li>
            <li><strong>Fully</strong> open source.</li>
        </ul>
    </div>

    <div class="community">
        <section class="community-card" aria-labelledby="conversation-heading">
            <div class="card-heading">
                <DiscordSolid class="h-7 w-7 shrink-0" />
                <h2 id="conversation-heading">Talk to us</h2>
            </div>
            <p>
                Have a question, an idea, or a game that isn’t behaving? Come chat with us on
                Discord. Compliments and complaints are welcome, too.
            </p>
            <a
                class="community-link"
                href="https://discord.gg/5ggK5VGGvA"
                target="_blank"
                rel="noreferrer"
            >
                Join us on Discord <ArrowRightOutline class="h-4 w-4" />
                <span class="sr-only">(opens in a new tab)</span>
            </a>
        </section>

        <section class="community-card" aria-labelledby="contribute-heading">
            <div class="card-heading">
                <GithubSolid class="h-7 w-7 shrink-0" />
                <h2 id="contribute-heading">Lend a hand</h2>
            </div>
            <p>
                Want to contribute? Take a look at the Tabletop project on GitHub. There are plenty
                of ways to help, with or without writing code.
            </p>
            <ul class="contributions" aria-label="Ways to contribute">
                <li>Design &amp; artwork</li>
                <li>Bug fixes &amp; features</li>
                <li>New games</li>
                <li>Ideas &amp; feedback</li>
            </ul>
            <a
                class="community-link"
                href="https://github.com/justinkwaugh/tabletop"
                target="_blank"
                rel="noreferrer"
            >
                Explore the project on GitHub <ArrowRightOutline class="h-4 w-4" />
                <span class="sr-only">(opens in a new tab)</span>
            </a>
        </section>
    </div>
</main>

<style>
    .about-page {
        padding-bottom: 64px;
        color: var(--color-gray-200);
    }
    .page-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px 24px;
    }
    .library-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--color-blue-300);
        font-size: 14px;
    }
    .introduction {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        align-items: start;
        gap: 64px;
        padding: 8px 0 36px;
        border-bottom: 1px solid var(--color-gray-700);
    }
    .lead {
        max-width: 32ch;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 28px;
        line-height: 1.35;
        letter-spacing: -0.015em;
    }
    .welcome {
        max-width: 56ch;
        margin-top: 16px;
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.7;
    }
    .principles {
        display: grid;
        gap: 12px;
        padding-left: 28px;
        border-left: 2px solid var(--color-highlight-border);
        font-family: 'Source Sans 3', sans-serif;
        font-size: 21px;
        line-height: 1.4;
    }
    .principles strong {
        font-weight: 600;
    }
    .community {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        margin-top: 32px;
        align-items: start;
    }
    .community-card {
        min-width: 0;
        padding: 28px;
        background: color-mix(in srgb, var(--color-gray-800) 50%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-gray-700) 60%, transparent);
        border-radius: 12px;
    }
    .card-heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        color: var(--color-blue-300);
    }
    h2 {
        font-family: 'Source Sans 3', sans-serif;
        font-size: 24px;
        font-weight: 600;
        line-height: 1.25;
        letter-spacing: -0.02em;
        color: var(--color-gray-200);
    }
    .community-card p {
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.7;
    }
    .contributions {
        list-style-type: disc;
        padding-left: 18px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 20px;
        margin-top: 20px;
        font-size: 14px;
        line-height: 1.5;
    }
    .community-link {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-top: 28px;
        color: var(--color-blue-300);
        font-size: 14px;
        line-height: 1.5;
    }
    a:hover {
        text-decoration: underline;
        text-underline-offset: 4px;
    }
    a:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 5px;
        border-radius: 3px;
    }
    @media (max-width: 900px) {
        .introduction {
            gap: 32px;
            grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        }
        .community-card {
            padding: 24px;
        }
        .contributions {
            grid-template-columns: 1fr;
        }
    }
    @media (max-width: 700px) {
        .about-page {
            padding-bottom: 48px;
        }
        .introduction {
            grid-template-columns: 1fr;
            gap: 24px;
            padding-bottom: 28px;
        }
        .lead {
            font-size: 24px;
        }
        .principles {
            font-size: 18px;
            padding-left: 16px;
            gap: 6px;
        }
        .community {
            grid-template-columns: 1fr;
            gap: 16px;
            margin-top: 24px;
        }
        .contributions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 12px;
        }
    }
</style>
