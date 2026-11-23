<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { Company } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PlaceLink from '../places/PlaceLink.svelte'
    import RemainingStationTokens from './RemainingStationTokens.svelte'
    import './cardOpener.css'
    import { controlMiddleY, pressesCardItself } from './cardPress.js'
    import { sessionStationTokens } from './stationTokens.js'
    import type { UnstartedCompanyHome } from '../session/titlePresentation.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        company,
        home,
        wide = false,
        starting,
        onToggleStart
    }: {
        session: EighteenXXSessionView
        company: Company
        home: UnstartedCompanyHome
        wide?: boolean
        starting: boolean
        onToggleStart: (card: HTMLElement, pointerY: number) => void
    } = $props()
    // Two or more token groups beside the name leave no room for "Not started" beside them too.
    const crowded = $derived(!wide && sessionStationTokens(session, company.id).groups.length > 1)
    const startKind = $derived(session.cardStarts.kind(company.id))
    const startLabel = $derived(startKind === 'auction' ? 'Auction' : 'Start')
    let card = $state<HTMLElement>()
    function toggleStart(pointerY: number) {
        assertExists(card, 'An unstarted company card opens its start')
        onToggleStart(card, pointerY)
    }
    function toggleStartFromCard(event: MouseEvent) {
        if (startKind && pressesCardItself(event)) toggleStart(event.clientY)
    }
</script>

<!-- The Start button is the keyboard path; a click anywhere else on the card is a shortcut. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
    bind:this={card}
    class="unstarted"
    class:wide
    class:crowded
    class:startable={!!startKind}
    class:selected={starting}
    aria-label={`${session.companyFullName(company.id)}, not started`}
    onclick={toggleStartFromCard}
>
    <span class="logo"
        ><CompanyToken
            appearance={session.mapView.stations[company.id]}
            size={wide ? 36 : 32}
        /></span
    >
    <h2 title={session.companyFullName(company.id)}>{session.companyName(company.id)}</h2>
    <div class="tokens">
        <RemainingStationTokens {session} companyId={company.id} vertical={!wide} />
    </div>
    <p class="status">Not started</p>
    <div class="home-line">
        {#if home === 'chosen'}<p class="home">Home chosen at start</p>
        {:else if home.locationIds.length}<p class="home">
                Home {#each home.locationIds as locationId, index (locationId)}{#if index}{' and '}{/if}<PlaceLink
                        {locationId}
                    />{/each}
            </p>{/if}
        {#if startKind}<button
                type="button"
                class="card-opener start-opener"
                aria-haspopup="dialog"
                aria-expanded={starting}
                aria-label={`${startLabel} ${session.companyName(company.id)}`}
                onclick={(event) => toggleStart(controlMiddleY(event.currentTarget))}
                >{startLabel}</button
            >{/if}
    </div>
</article>

<style>
    /*
     * Laid out as a started company's card is: the name beside its token, the station tokens at
     * the top right. Unstarted cards are greyed by colour, and only the token images fade, as an
     * opacity on a whole card is drawn offscreen on phones (docs/phone-rendering.md).
     */
    .unstarted {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        column-gap: 9px;
        align-items: start;
        box-sizing: border-box;
        width: 200px;
        max-width: 100%;
        margin: 3px 0 8px;
        padding: 8px 10px;
        border: 1px dashed var(--rail-border, #d2c5b7);
        border-radius: 7px;
        color: var(--rail-muted, #887664);
    }
    .unstarted.wide {
        width: 100%;
        border-radius: 10px;
    }
    .logo,
    .tokens {
        opacity: 0.5;
    }
    .logo {
        display: flex;
        grid-row: 1 / span 3;
        grid-column: 1;
    }
    h2 {
        grid-row: 1;
        grid-column: 2;
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tokens {
        grid-row: 1 / span 2;
        grid-column: 3;
    }
    .crowded .tokens {
        grid-row: 1;
    }
    p {
        margin: 2px 0 0;
        font-size: 11px;
    }
    .status {
        grid-row: 2;
        grid-column: 2;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .crowded .status {
        grid-column: 2 / -1;
    }
    .home-line {
        display: flex;
        align-items: baseline;
        gap: 8px;
        grid-row: 3;
        grid-column: 2 / -1;
    }
    .home {
        font-size: 12px;
    }
    .startable {
        cursor: pointer;
    }
    .startable:hover,
    .selected {
        border-color: var(--rail-focus, #a87948);
    }
    .start-opener {
        margin-left: auto;
    }
</style>
