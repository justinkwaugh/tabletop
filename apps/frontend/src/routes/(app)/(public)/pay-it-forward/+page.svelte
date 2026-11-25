<script lang="ts">
    import { ArrowUpRightFromSquareOutline, ShieldCheckOutline } from 'flowbite-svelte-icons'
    import LibraryLink from '$lib/components/project/LibraryLink.svelte'
    import ProjectPrinciples from '$lib/components/project/ProjectPrinciples.svelte'
    import Wordmark from '$lib/components/project/Wordmark.svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'
    import { getLocale } from '$lib/paraglide/runtime'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        Charity,
        type CharityRaised,
        type CharityTally,
        type CurrencyCode
    } from '@tabletop/common'
    import { onMount } from 'svelte'
    import gamersOutreachLogo from '$lib/components/images/charities/gamers-outreach.png'
    import specialEffectLogo from '$lib/components/images/charities/specialeffect.png'

    type CharityCard = {
        id: Charity
        name: string
        logo: string
        country: () => string
        purpose: () => string
        description: () => string
        campaignUrl: string
        donateUrl: string
        donateHost: string
    }

    const charities: CharityCard[] = [
        {
            id: Charity.GamersOutreach,
            name: 'Gamers Outreach',
            logo: gamersOutreachLogo,
            country: m.content_pif_us_charity,
            purpose: m.content_pif_gamers_outreach_purpose,
            description: m.content_pif_gamers_outreach_description,
            campaignUrl:
                'https://tiltify.com/+boardtogether-community/fundraiser-for-gamers-outreach-foundation',
            donateUrl: 'https://gamersoutreach.org/donate',
            donateHost: 'gamersoutreach.org'
        },
        {
            id: Charity.SpecialEffect,
            name: 'SpecialEffect',
            logo: specialEffectLogo,
            country: m.content_pif_uk_charity,
            purpose: m.content_pif_special_effect_purpose,
            description: m.content_pif_special_effect_description,
            campaignUrl:
                'https://tiltify.com/+boardtogether-community/fundraiser-for-specialeffect',
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
                ? [
                      m.content_pif_raised_for({
                          amount: formatMoney(raised.amount, raised.currency),
                          charity: charity.name
                      })
                  ]
                : []
        })
        return [m.content_pif_raised_by_players(), ...perCharity].join(' · ')
    }

    function formatMoney(amount: number, currency: CurrencyCode): string {
        return new Intl.NumberFormat(getLocale(), {
            style: 'currency',
            currency,
            maximumFractionDigits: 0
        }).format(Math.floor(amount))
    }
</script>

{#snippet wordmark()}<Wordmark />{/snippet}

<svelte:head>
    <title>{m.content_pif_page_title()}</title>
    <meta name="description" content={m.content_pif_page_description()} />
</svelte:head>

<main class="pay-it-forward-page collection-page">
    <header class="page-heading collection-header">
        <h1 class="collection-heading">{m.content_pif_heading()}</h1>
        <LibraryLink label={m.content_back_to_library()} />
    </header>

    <div class="introduction">
        <p class="lead">
            <RichMessage parts={m.content_pif_lead.parts()} markup={{ wordmark }} />
        </p>
        <div class="principles-column">
            <ProjectPrinciples />
        </div>
    </div>

    <section aria-labelledby="no-donations-heading">
        <h2 id="no-donations-heading" class="statement refusal">
            {m.content_pif_no_donations()}
        </h2>
        <p class="body">{m.content_pif_bills_are_ours()}</p>
    </section>

    <section aria-labelledby="pass-it-on-heading">
        <h2 id="pass-it-on-heading" class="statement">{m.content_pif_pass_it_on()}</h2>
        <p class="body">
            {m.content_pif_pass_it_on_body()}
            <span class="wide-only">{m.content_pif_pass_it_on_wide()}</span>
        </p>
    </section>

    <ul class="charities" aria-label={m.content_pif_charities_label()}>
        {#each charities as charity (charity.id)}
            {@const campaignOpen = raisedFor(charity.id)?.campaignOpen ?? true}
            <li class="charity">
                <div class="charity-heading">
                    <h3><img class="logo" src={charity.logo} alt={charity.name} /></h3>
                    <span class="country">{charity.country()}</span>
                </div>
                <p class="purpose">{charity.purpose()}</p>
                <p class="description">{charity.description()}</p>
                <a
                    class="give-link"
                    href={campaignOpen ? charity.campaignUrl : charity.donateUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    {m.content_pif_give_to({ charity: charity.name })}
                    <ArrowUpRightFromSquareOutline class="h-4 w-4" />
                    <span class="sr-only">{m.content_opens_in_new_tab()}</span>
                </a>
                <p class="destination">
                    {campaignOpen
                        ? m.content_pif_opens_campaign()
                        : m.content_pif_opens_donation_page({ host: charity.donateHost })}
                </p>
            </li>
        {/each}
    </ul>

    {#if tally && tally.totalUsd > 0}
        <section class="tally" aria-label={m.content_pif_raised_so_far()}>
            <p class="tally-total">{formatMoney(tally.totalUsd, 'USD')}</p>
            <p class="tally-detail">{tallyDetail()}</p>
        </section>
    {/if}

    <p class="body other-charities">
        {m.content_pif_other_charities()}
    </p>

    <p class="trust">
        <ShieldCheckOutline class="h-4 w-4 shrink-0" />
        {m.content_pif_receives_nothing()}
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
    .charity-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        align-self: stretch;
        min-height: 64px;
        margin-bottom: 20px;
    }
    .logo {
        display: block;
        width: 168px;
        height: auto;
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
        .description {
            margin-top: 12px;
        }
        .destination {
            display: none;
        }
    }
</style>
