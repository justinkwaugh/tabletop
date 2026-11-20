<script lang="ts">
    import { CompanyToken, TitlePrompt, TrainBadge } from '@tabletop/18xx-ui'
    import type { Session1828 } from './session.svelte.js'
    let { session }: { session: Session1828 } = $props()
    const initials = (companyId: string) => session.companyInitials(companyId)
    const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name
    type ShellArrangement = NonNullable<Session1828['shellArrangement']>
    type Shell = ShellArrangement['shells'][number]
    function shellTrainLabel(
        { swapping, swapTrainId }: ShellArrangement,
        train: Shell['trains'][number],
        shell: Shell,
        otherShell: Shell
    ): string {
        const name = `${trainName(train.definitionId)}-train`
        if (!swapping) return `Move the ${name} to the ${initials(otherShell.companyId)} shell`
        const partner = otherShell.trains.find(({ trainId }) => trainId === swapTrainId)
        return partner
            ? `Swap the ${name} with the ${trainName(partner.definitionId)}-train`
            : `Pick the ${name} in the ${initials(shell.companyId)} shell to swap`
    }
</script>

{#if session.cobourgReplacementCompanyId}
    {@const companyId = session.cobourgReplacementCompanyId}
    <TitlePrompt
        text="Replace the C&P station in Peterborough with a {initials(
            companyId
        )} station, as this round’s station?"
    >
        <span class="choices"
            ><button
                class="action-button inline-action"
                disabled={session.actionsLocked}
                onclick={() => session.replaceCobourgStation(true)}>Replace</button
            ><button
                class="action-button inline-action"
                disabled={session.actionsLocked}
                onclick={() => session.replaceCobourgStation(false)}>Leave it blocking</button
            ></span
        >
    </TitlePrompt>
{/if}

{#if session.shellArrangement}
    {@const arrangement = session.shellArrangement}
    <section class="shells" aria-label="Shells">
        <p class="prompt">
            {#if arrangement.swapping}
                Both shells are full: pick a train from each to swap them.
            {:else}
                Before buying, move trains between the system’s shells: each holds up to {arrangement.limit}.
            {/if}
        </p>
        <div class="shell-row">
            {#each arrangement.shells as shell, index (shell.companyId)}
                <div class="shell" aria-label="{initials(shell.companyId)} shell">
                    <h3>
                        <CompanyToken
                            appearance={session.mapView.stations[shell.companyId]}
                            size={18}
                        />{initials(shell.companyId)} shell
                    </h3>
                    <div class="trains">
                        {#each shell.trains as train (train.trainId)}
                            <button
                                class="train"
                                disabled={session.actionsLocked ||
                                    !(train.movable || arrangement.swapping)}
                                aria-pressed={arrangement.swapTrainId === train.trainId}
                                aria-label={shellTrainLabel(
                                    arrangement,
                                    train,
                                    shell,
                                    arrangement.shells[1 - index]
                                )}
                                onclick={() => session.moveShellTrain(train.trainId)}
                                ><TrainBadge
                                    name={trainName(train.definitionId)}
                                    color={session.presentation.trainColors[train.definitionId]}
                                />{#if train.movable}<span class="arrow" aria-hidden="true"
                                        >{index === 0 ? '→' : '←'}</span
                                    >{/if}</button
                            >
                        {:else}
                            <span class="empty">No trains</span>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </section>
{/if}

{#if session.trainShellChoice}
    {@const choice = session.trainShellChoice}
    <div class="shell-choice" role="group" aria-label="Shell for the next train">
        <span>Next train goes to</span>
        {#each choice.shellCompanyIds as companyId (companyId)}
            <button
                class="action-button inline-action"
                aria-pressed={choice.nextShellCompanyId === companyId}
                disabled={session.actionsLocked}
                onclick={() => session.chooseTrainShell(companyId)}
                >{initials(companyId)} shell</button
            >
        {/each}
    </div>
{/if}

<style>
    /* A prompt's choices wrap below its question together, never one by one. */
    .choices {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .shells {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        margin: 4px 0 8px;
        font-size: 12px;
        color: var(--rail-text, #514536);
    }
    .shell-choice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 4px 0 8px;
        font-size: 12px;
        color: var(--rail-text, #514536);
    }
    .train[aria-pressed='true'],
    .shell-choice button[aria-pressed='true'] {
        outline: 2px solid var(--rail-focus, #443e35);
        outline-offset: 1px;
    }
    .prompt {
        margin: 0;
        text-align: center;
    }
    .shell-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
    }
    .shell {
        min-width: 140px;
        padding: 6px 8px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
    }
    h3 {
        display: flex;
        align-items: center;
        gap: 5px;
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rail-muted, #887969);
    }
    .trains {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .train {
        --train-badge-font: 14px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
        color: var(--rail-text, #514536);
        cursor: pointer;
    }
    .train:hover:not(:disabled) {
        border-color: var(--rail-focus, #796047);
    }
    .train:disabled {
        cursor: default;
    }
    .arrow {
        font-weight: 600;
    }
    .empty {
        color: var(--rail-muted, #887969);
    }
</style>
