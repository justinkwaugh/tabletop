<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import TrainPurchaseButton from '../trains/TrainPurchaseButton.svelte'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, trainColors }: { session: FinanceExampleSession; trainColors: Readonly<Record<string, string>> } = $props()
    const privateIds = $derived([...new Set(session.privateTrainOptions.map((option) => option.privateCompanyId))])
</script>

<div class="private-trains">
    {#each privateIds as privateId}
        <section aria-label={`Use ${getCompany(session.financialState, privateId).name}`}>
            <p>Buy a train and close {getCompany(session.financialState, privateId).name}</p>
            <div class="trains">
                {#each session.privateTrainOptions.filter((option) => option.privateCompanyId === privateId) as option}
                    {@const definition = session.trainDepot.trainDefinition(option.details.definitionId)}
                    <TrainPurchaseButton name={definition.name} price={option.details.price}
                        color={trainColors[definition.id]} definitionId={definition.id}
                        disabled={!session.canResolveCompanyDecision}
                        onclick={() => session.buyPrivateTrain(option)} />
                {/each}
            </div>
        </section>
    {/each}
</div>

<style>
    .private-trains { width: 100%; padding: 4px 0; color: #514536; font-size: 13px; }
    p { margin: 0 0 8px; text-align: center; }
    .trains { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
</style>
