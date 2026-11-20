<script lang="ts">
    import { ForeignInvestors1880, investorChooser } from '@tabletop/1880'
    import { placeReference } from '@tabletop/18xx'
    import { CompanyToken, PlaceText } from '@tabletop/18xx-ui'
    import type { Session1880 } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    let { session }: { session: Session1880 } = $props()
    const chooser = $derived(investorChooser(session.gameState))
    const TokenSize = 44
</script>

<TitlePanel label="Choose a foreign investor">
    {#if session.investorChoices.length}
        <p>
            Choose a foreign investor, free. It builds a tile a turn and runs the train on sale,
            keeping its income, until it joins your first company’s network.
        </p>
        <ul class="choices" aria-label="Foreign investors">
            {#each session.investorChoices as investorId (investorId)}
                {@const investor = ForeignInvestors1880.find((entry) => entry.id === investorId)}
                <li>
                    <button
                        class="investor"
                        disabled={session.busy}
                        data-investor={investorId}
                        title={`Choose the ${investor?.name}`}
                        aria-label={`Choose the ${investor?.name}`}
                        onclick={() => session.chooseInvestor(investorId)}
                        ><CompanyToken
                            appearance={session.mapView.stations[investorId]}
                            size={TokenSize}
                        /></button
                    >
                    {#if investor}<span class="home"
                            ><PlaceText text={placeReference(investor.home)} /></span
                        >{/if}
                </li>
            {/each}
        </ul>
    {:else if chooser}
        <p>{session.getPlayerName(chooser)} is choosing a foreign investor.</p>
    {/if}
</TitlePanel>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px 16px;
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
    }
    li {
        display: grid;
        justify-items: center;
        gap: 4px;
        min-width: 64px;
    }
    .investor {
        display: block;
        padding: 3px;
        border: 0;
        border-radius: 50%;
        background: none;
        cursor: pointer;
    }
    .investor :global(svg) {
        display: block;
    }
    .investor:hover:not(:disabled),
    .investor:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 1px;
    }
    .investor:disabled {
        cursor: default;
        opacity: 0.6;
    }
    .home {
        font-size: 12px;
        white-space: nowrap;
    }
</style>
