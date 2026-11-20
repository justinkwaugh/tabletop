<script lang="ts">
    import { CompanyToken, TrainBadge } from '@tabletop/18xx-ui'
    import type { Session1880 } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    let { session }: { session: Session1880 } = $props()
    const TokenSize = 40
</script>

{#if session.forcedRocket}
    {@const { companyIds, makesRoom } = session.forcedRocket}
    <TitlePanel label="Exchange the Rocket of China">
        <p>
            The first 4-train closes the Rocket of China: choose the company that takes the second
            4-train{makesRoom ? ', and the train it gives up to make room' : ''}.
        </p>
        {#if makesRoom}
            {#each companyIds as companyId (companyId)}
                {@const name = session.actionCompanyName(companyId)}
                <div class="discards" role="group" aria-label={name}>
                    <span class="token" title={name}
                        ><CompanyToken
                            appearance={session.mapView.stations[companyId]}
                            size={TokenSize}
                        /></span
                    >
                    <!-- One choice for each kind of train: trains of a kind are alike. -->
                    {#each session
                        .rocketDiscards(companyId)
                        .filter((train, index, trains) => trains.findIndex((other) => other.definitionId === train.definitionId) === index) as train (train.id)}
                        <button
                            class="action-button discard"
                            disabled={session.busy}
                            aria-label={`${name}: give up its ${train.definitionId}-train`}
                            onclick={() => session.exchangeRocket(companyId, train.id)}
                            >Give up <TrainBadge
                                name={train.definitionId}
                                color={session.presentation.trainColors[train.definitionId] ??
                                    '#888'}
                            /></button
                        >
                    {/each}
                </div>
            {/each}
        {:else}
            <ul class="companies" aria-label="Companies">
                {#each companyIds as companyId (companyId)}
                    {@const name = session.actionCompanyName(companyId)}
                    <li>
                        <button
                            class="company"
                            disabled={session.busy}
                            title={`${name} takes the 4-train`}
                            aria-label={`${name} takes the 4-train`}
                            onclick={() => session.exchangeRocket(companyId)}
                            ><CompanyToken
                                appearance={session.mapView.stations[companyId]}
                                size={TokenSize}
                            /></button
                        >
                    </li>
                {/each}
            </ul>
        {/if}
    </TitlePanel>
{/if}

<style>
    .companies {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
    }
    .company {
        display: block;
        padding: 3px;
        border: 0;
        border-radius: 50%;
        background: none;
        cursor: pointer;
    }
    .company:hover:not(:disabled),
    .company:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 1px;
    }
    .company:disabled {
        cursor: default;
        opacity: 0.6;
    }
    .discards {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    .token,
    .company :global(svg),
    .token :global(svg) {
        display: block;
    }
    .discard {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
</style>
