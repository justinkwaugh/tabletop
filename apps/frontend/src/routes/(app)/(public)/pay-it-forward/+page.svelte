<script lang="ts">
    import { ArrowUpRightFromSquareOutline, ShieldCheckOutline } from 'flowbite-svelte-icons'
    import LibraryLink from '$lib/components/project/LibraryLink.svelte'
    import ProjectPrinciples from '$lib/components/project/ProjectPrinciples.svelte'
    import Wordmark from '$lib/components/project/Wordmark.svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { Charity, type CharityRaised, type CharityTally } from '@tabletop/common'
    import { onMount } from 'svelte'

    type CharityCard = {
        id: Charity
        name: string
        country: string
        purpose: string
        description: string
        campaignUrl: string
        donateUrl: string
        donateHost: string
    }

    const charities: CharityCard[] = [
        {
            id: Charity.GamersOutreach,
            name: 'Gamers Outreach',
            country: 'US',
            purpose: 'Play for kids in hospitals',
            description:
                'Builds medical-grade gaming carts and brings them to kids in hospital who can’t leave their rooms. Over 350 hospitals so far.',
            campaignUrl:
                'https://tiltify.com/@boardtogether/board-together-fundraiser-for-gamers-outreach-foundation',
            donateUrl: 'https://gamersoutreach.org/donate',
            donateHost: 'gamersoutreach.org'
        },
        {
            id: Charity.SpecialEffect,
            name: 'SpecialEffect',
            country: 'UK',
            purpose: 'Play for people with disabilities',
            description:
                'Occupational therapists and gaming specialists set up adapted controllers and eye control, so people with physical disabilities can play the games they love.',
            campaignUrl:
                'https://tiltify.com/@boardtogether/boardtogether-fundraiser-for-specialeffect',
            donateUrl: 'https://www.specialeffect.org.uk/donate',
            donateHost: 'specialeffect.org.uk'
        }
    ]

    const { api } = getAppContext()
    let tally: CharityTally | undefined = $state()

    onMount(async () => {
        try {
            tally = await api.getCharityTally()
        } catch (error) {
            console.error('Could not load the charity tally', error)
        }
    })

    function raisedFor(charity: Charity): CharityRaised | undefined {
        return tally?.charities.find((raised) => raised.charity === charity)
    }

    function tallyDetail(): string {
        const perCharity = charities.flatMap((charity) => {
            const raised = raisedFor(charity.id)
            return raised
                ? [`${formatMoney(raised.amount, raised.currency)} for ${charity.name}`]
                : []
        })
        return ['raised by Board Together players', ...perCharity].join(' · ')
    }

    function formatMoney(amount: number, currency: string): string {
        return new Intl.NumberFormat('en', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
            roundingMode: 'trunc'
        }).format(amount)
    }
</script>

<svelte:head>
    <title>Pay it forward — Board Together</title>
    <meta
        name="description"
        content="Board Together is free and takes no personal donations. If you've enjoyed playing, help bring games to people who need them through Gamers Outreach or SpecialEffect."
    />
</svelte:head>

<main class="pay-it-forward-page collection-page">
    <header class="page-heading collection-header">
        <h1 class="collection-heading">Pay it forward.</h1>
        <LibraryLink label="Back to the library" />
    </header>

    <div class="introduction">
        <p class="lead"><Wordmark /> is free, and we plan to keep it that way.</p>
        <div class="principles-column">
            <ProjectPrinciples />
        </div>
    </div>

    <section aria-labelledby="no-donations-heading">
        <h2 id="no-donations-heading" class="statement refusal">
            We don’t take personal donations.
        </h2>
        <p class="body">The bills are ours, and nothing you give from this page comes to us.</p>
    </section>

    <section aria-labelledby="pass-it-on-heading">
        <h2 id="pass-it-on-heading" class="statement">Pass it on instead.</h2>
        <p class="body">
            If the games here have been worth something to you, help put games in front of people
            who need them. Few board game charities work at scale and meet the bar we set, so we
            picked these two.
            <span class="wide-only"
                >They bring play to people who can’t easily get to it: kids stuck in hospital rooms,
                and players who need adapted controls.</span
            >
        </p>
    </section>

    <ul class="charities" aria-label="Charities">
        {#each charities as charity (charity.id)}
            {@const campaignOpen = raisedFor(charity.id)?.campaignOpen ?? true}
            <li class="charity">
                <h3 class="charity-name">
                    {charity.name}<span class="country">{charity.country} charity</span>
                </h3>
                <p class="purpose">{charity.purpose}</p>
                <p class="description">{charity.description}</p>
                <a
                    class="give-link"
                    href={campaignOpen ? charity.campaignUrl : charity.donateUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    Give to {charity.name}
                    <ArrowUpRightFromSquareOutline class="h-4 w-4" />
                    <span class="sr-only">(opens in a new tab)</span>
                </a>
                <p class="destination">
                    {campaignOpen
                        ? 'Opens the Board Together campaign on tiltify.com.'
                        : `Opens their donation page on ${charity.donateHost}.`}
                </p>
            </li>
        {/each}
    </ul>

    {#if tally && tally.totalUsd > 0}
        <section class="tally" aria-label="Raised so far">
            <p class="tally-total">{formatMoney(tally.totalUsd, 'USD')}</p>
            <p class="tally-detail">{tallyDetail()}</p>
        </section>
    {/if}

    <p class="body other-charities">
        If these two aren’t for you, give to your favorite charity instead. It’s paying it forward
        all the same.
    </p>

    <p class="trust">
        <ShieldCheckOutline class="h-4 w-4 shrink-0" />
        Board Together gets nothing from these links: no referral fee, no cut, no data back to us.
    </p>
</main>

<style>
    .pay-it-forward-page {
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
    .introduction {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        align-items: start;
        gap: 64px;
        padding: 8px 0 12px;
    }
    .lead {
        max-width: 32ch;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 28px;
        line-height: 1.35;
        letter-spacing: -0.015em;
    }
    .statement {
        margin-top: 32px;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 24px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: -0.015em;
        color: var(--color-gray-100);
    }
    .statement.refusal {
        color: #5e9cf0;
    }
    .body {
        margin-top: 4px;
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.7;
    }
    .charities {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        margin-top: 28px;
    }
    .charity {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        padding: 28px;
        background: color-mix(in srgb, var(--color-gray-800) 50%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-gray-700) 60%, transparent);
        border-radius: 12px;
    }
    .charity-name {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 12px;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 26px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: -0.015em;
        color: var(--color-gray-100);
    }
    .country {
        padding: 1px 10px;
        border: 1px solid var(--color-gray-600);
        border-radius: 999px;
        font-family: Inter, system-ui, sans-serif;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.5;
        letter-spacing: 0;
        color: var(--color-gray-300);
    }
    .purpose {
        margin-top: 2px;
        color: var(--color-gray-300);
        font-size: 15px;
        font-weight: 500;
    }
    .description {
        flex: 1;
        margin-top: 16px;
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.7;
    }
    .give-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 20px;
        color: var(--color-blue-300);
        font-size: 15px;
    }
    .destination {
        margin-top: 8px;
        color: var(--color-gray-500);
        font-size: 13px;
    }
    .tally {
        margin-top: 24px;
        padding: 20px 28px;
        border: 1px solid color-mix(in srgb, var(--color-gray-700) 60%, transparent);
        border-radius: 12px;
    }
    .tally-total {
        font-family: 'Source Sans 3', sans-serif;
        font-size: 32px;
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.015em;
        color: var(--color-gray-100);
    }
    .tally-detail {
        margin-top: 4px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .other-charities {
        margin-top: 28px;
    }
    .trust {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        color: var(--color-gray-500);
        font-size: 13px;
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
        .charity {
            padding: 24px;
        }
    }
    @media (max-width: 700px) {
        .pay-it-forward-page {
            padding-bottom: 48px;
        }
        .introduction {
            grid-template-columns: 1fr;
        }
        .principles-column {
            display: none;
        }
        .lead {
            font-size: 24px;
        }
        .statement {
            margin-top: 24px;
            font-size: 21px;
        }
        .wide-only {
            display: none;
        }
        .charities {
            grid-template-columns: 1fr;
            gap: 16px;
            margin-top: 24px;
        }
        .charity-name {
            font-size: 24px;
        }
        .description {
            margin-top: 12px;
        }
        .destination {
            display: none;
        }
    }
</style>
