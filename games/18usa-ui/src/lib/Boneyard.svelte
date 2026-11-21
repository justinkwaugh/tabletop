<script lang="ts">
    import { PennsyBoneyardId } from '@tabletop/18usa'
    import { assertExists } from '@tabletop/common'
    import { CompanyToken, TrainBadge } from '@tabletop/18xx-ui'
    import type { EighteenUSASession } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    let { session }: { session: EighteenUSASession } = $props()
    const boneyard = $derived.by(() => {
        assertExists(session.boneyard, 'A rust waits on the Pennsy Boneyard')
        return session.boneyard
    })
    const disabled = $derived(!session.canSaveTrain)
    const trains = $derived(
        boneyard.trainIds.map((trainId) => {
            const train = session.gameState.trainInventory.trains.find(
                (entry) => entry.id === trainId
            )
            assertExists(train, `Rusting train ${trainId} is in the inventory`)
            return train
        })
    )
</script>

<TitlePanel label="Pennsy Boneyard">
    <span class="company"
        ><CompanyToken appearance={session.mapView.stations[boneyard.companyId]} size={18} />
        <strong>{session.companyName(boneyard.companyId)}</strong></span
    >
    <p>
        <strong>{session.companyName(PennsyBoneyardId)}</strong>: {session.privates.description(
            PennsyBoneyardId
        )}
    </p>
    {#if session.canSaveTrain}
        <div class="choices">
            {#each trains as train (train.id)}
                <button
                    {disabled}
                    data-train-id={train.id}
                    aria-label={`Save the ${session.trainLabel(train)}`}
                    onclick={() => void session.saveTrain(train.id)}
                    >Save <TrainBadge
                        name={session.trainLabel(train)}
                        color={session.presentation.trainColors[train.definitionId] ?? '#a3a3a3'}
                    /></button
                >
            {/each}
            <button {disabled} onclick={() => void session.saveTrain(undefined)}
                >Let them rust</button
            >
        </div>
    {:else}
        <p>Waiting for {session.companyName(boneyard.companyId)}’s president to choose.</p>
    {/if}
</TitlePanel>

<style>
    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        padding: 6px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #fffdf8);
        color: inherit;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .company {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
</style>
