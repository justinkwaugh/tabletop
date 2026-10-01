<script lang="ts">
    import { type OpportunityTake } from '@tabletop/oath'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { humanizeReason } from '$lib/model/names.js'

    // R-4.1.1 to R-4.1.4 — a Wake with nothing to decide is resolved by the engine.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let me = $derived(gameSession.myPlayer)
    let wake = $derived(gameSession.wake)
    let busy = $derived(gameSession.busy)

    let stepCount = $derived(wake.stepCount)
    let holdsPeoplesFavor = $derived(wake.holdsPeoplesFavor)
    let kinds = $derived(wake.kinds)
    let suits = $derived(wake.suits)
    let sitePowerTake = $derived(wake.sitePowerTake)
    let sitePowerOffered = $derived(wake.sitePowerOffered)
    let takes = $derived<(OpportunityTake | undefined)[]>([undefined, ...wake.sitePowerTakes])

    let blockedBecause = $derived(wake.blockedBecause)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">Wake Phase</h3>

    {#if stepCount > 0}
        <div class="mb-2">
            <div class="text-[10px] uppercase tracking-[0.15em] text-oath-text-muted mb-1">
                The People’s Favor{#if stepCount > 1}, twice on the Mob side{/if}
            </div>
            {#each kinds as kind, index (index)}
                <div class="mb-1 border-t border-oath-divider pt-1">
                    <div class="flex gap-1 mb-1">
                        {#each wake.optionsAt(index) as option (option)}
                            <button
                                disabled={busy}
                                class="rounded border px-2 py-0.5 text-xs {kind === option
                                    ? 'border-oath-accent bg-oath-accent-soft'
                                    : 'border-oath-divider bg-oath-surface-raised hover:border-oath-accent'}"
                                onclick={() => wake.setKind(index, option)}
                            >
                                {option === 'place'
                                    ? 'Place one of your favor on it'
                                    : 'Return one of its favor to a bank'}
                            </button>
                        {/each}
                    </div>
                    {#if kind === 'return'}
                        {@const suit = suits[index]}
                        <SuitPicker
                            suits={wake.leastBanksAt(index)}
                            picked={suit === undefined ? [] : [suit]}
                            onpick={(picked) => wake.setSuit(index, picked)}
                            {busy}
                        />
                    {/if}
                </div>
            {/each}
        </div>
    {:else if holdsPeoplesFavor}
        <p class="mb-2 text-[11px] text-oath-text-muted">
            You hold the People’s Favor but can neither place nor return a favor, so the step is
            skipped.
        </p>
    {/if}

    {#if sitePowerOffered}
        <div class="mb-2">
            <div class="text-[10px] uppercase tracking-[0.15em] text-oath-text-muted mb-1">
                Your site’s power, optional
            </div>
            <div class="flex gap-1">
                {#each takes as take (take ?? 'decline')}
                    <button
                        disabled={busy}
                        class="rounded border px-2 py-0.5 text-xs {sitePowerTake === take
                            ? 'border-oath-accent bg-oath-accent-soft'
                            : 'border-oath-divider bg-oath-surface-raised hover:border-oath-accent'}"
                        onclick={() => wake.setSitePowerTake(take)}
                    >
                        {take === undefined ? 'Decline' : `Take a ${take}`}
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    {#if blockedBecause}
        <p class="mb-2 text-[11px] text-oath-danger">{humanizeReason(blockedBecause)}</p>
    {/if}

    <button
        class="w-full rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
               px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!blockedBecause}
        onclick={() => wake.resolve()}
    >
        Resolve the Wake and start your turn
    </button>
</div>
