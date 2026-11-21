<script lang="ts">
    import { company1860 } from '@tabletop/1860'
    import { CompanyToken, TrainBadge } from '@tabletop/18xx-ui'
    import type { Session1860 } from './session.svelte.js'
    let { session }: { session: Session1860 } = $props()
    const token = (companyId: string) => session.mapView.stations[companyId]
    const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name
    const homeCompanyId = $derived(session.homeTileCompanyId)
    const director = $derived(session.gameState.activePlayerIds[0])
    const myDecision = $derived(!!director && director === session.myPlayer?.id)
    const trainReturn = $derived(session.trainReturn)
</script>

{#snippet heading(companyId: string, text: string)}
    <h3><CompanyToken appearance={token(companyId)} size={28} /><span>{text}</span></h3>
{/snippet}

{#if homeCompanyId}
    {@const place = session.placeName(company1860(homeCompanyId).home)}
    <section class="centered-panel title-decision" aria-label="Home tile">
        {#if myDecision}
            {@render heading(
                homeCompanyId,
                `Lay ${session.companyName(homeCompanyId)}’s home tile in ${place}`
            )}
            <p class="note">
                Its home hex has no track yet. Choose {place} on the map, pick a tile and turn it, then
                confirm: the tile is free, and its home base stands on it.
            </p>
        {:else if director}
            {@render heading(
                homeCompanyId,
                `${session.getPlayerName(director)} lays ${session.companyName(homeCompanyId)}’s home tile in ${place}`
            )}
        {/if}
    </section>
{:else if trainReturn}
    <section class="centered-panel title-decision" aria-label="Train limit">
        {@render heading(
            trainReturn.companyId,
            `${session.companyName(trainReturn.companyId)} is over its train limit`
        )}
        <p class="note">
            Return a train to the bank, without compensation, before its turn begins. The bank sells
            it again at face value.
        </p>
        <div class="choices">
            {#each trainReturn.trains as train (train.id)}
                <button
                    class="action-button train-choice"
                    disabled={!session.canChooseAction}
                    aria-label={`Return the ${trainName(train.definitionId)}`}
                    onclick={() => session.returnTrain(train.id)}
                    ><span>Return</span><TrainBadge
                        name={trainName(train.definitionId)}
                        color={session.presentation.trainColors[train.definitionId]}
                    /></button
                >
            {/each}
        </div>
    </section>
{/if}

<style>
    .action-button {
        margin: 0;
        padding: 5px 14px;
        border-radius: 4px;
        cursor: pointer;
    }
    .action-button:disabled {
        cursor: default;
    }
    .title-decision {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    h3 {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
    }
    .note {
        margin: 0;
        max-width: 34em;
        text-align: center;
        font-size: 12px;
        color: var(--rail-muted, #786550);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .train-choice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
</style>
