<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import TrainPurchaseButton from './TrainPurchaseButton.svelte'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        trainColors
    }: { session: EighteenXXSession; trainColors: Readonly<Record<string, string>> } = $props()
    const money = $derived(session.presentation.money)
    const privateIds = $derived([
        ...new Set(session.decisions.privateTrainOptions.map((option) => option.privateCompanyId))
    ])
</script>

<div class="private-trains">
    {#each privateIds as privateId}
        <section aria-label={`Use ${getCompany(session.gameState, privateId).name}`}>
            <p>Buy a train and close {getCompany(session.gameState, privateId).name}</p>
            <div class="trains">
                {#each session.decisions.privateTrainOptions.filter((option) => option.privateCompanyId === privateId) as option}
                    {@const definition = session.trainDepot.trainDefinition(
                        option.details.definitionId
                    )}
                    <TrainPurchaseButton
                        {money}
                        name={definition.name}
                        price={option.details.price}
                        color={trainColors[definition.id]}
                        imageUrl={session.publishedTrainImage(definition.id)}
                        listPrice={definition.price}
                        definitionId={definition.id}
                        disabled={!session.decisions.canResolve}
                        onclick={() => session.decisions.buyPrivateTrain(option)}
                    />
                {/each}
            </div>
        </section>
    {/each}
</div>

<style>
    .private-trains {
        width: 100%;
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    p {
        margin: 0 0 8px;
        text-align: center;
    }
    .trains {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
</style>
