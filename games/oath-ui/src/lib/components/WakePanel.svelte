<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import { Banner } from '@tabletop/oath'
    import { bannerImage } from '$lib/images/tileImages.js'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { bannerName, cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-4.1.1 to R-4.1.4 — one choice at a time; every tap acts, and the last one sends the Wake.
    // A Wake with nothing to decide is resolved by the engine.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let wake = $derived(gameSession.wake)
    let busy = $derived(gameSession.busy)

    let question = $derived(wake.question)
    let stepCount = $derived(wake.stepCount)
    let siteCardId = $derived(wake.siteCardId)
    let refusedBecause = $derived(wake.refusedBecause)

    const PEOPLES_FAVOR = `the ${bannerName(Banner.PeoplesFavor)}`
    let peoplesFavorImage = $derived(
        bannerImage(Banner.PeoplesFavor, gameState.isOnMobSide(Banner.PeoplesFavor))
    )

    const choiceWidth = new ChoiceWidth()
</script>

{#snippet choice(label: string, text: string, onclick: () => void)}
    <button
        type="button"
        class="flex min-h-11 items-center justify-center rounded-md border border-oath-frame
               bg-oath-surface px-4 py-1.5 text-[15px] font-semibold
               hover:border-oath-accent hover:bg-oath-accent-soft disabled:opacity-40"
        disabled={busy}
        aria-label={label}
        {onclick}
    >
        <span class="flex justify-center" style:min-width="{choiceWidth.widest}px">
            <span class="w-max" {@attach choiceWidth.measure}><TokenText {text} /></span>
        </span>
    </button>
{/snippet}

<div>
    {#each wake.answeredLines as line, index (index)}
        <p class="mb-1 text-xs text-oath-text-muted"><TokenText text={line} /></p>
    {/each}

    {#if question}
        <h3 class="mb-2 text-[11px] uppercase tracking-[0.2em] text-oath-heading">
            {#if question.kind === 'siteTake'}
                {siteCardId ? cardName(siteCardId) : 'Your site'}
            {:else}
                {bannerName(Banner.PeoplesFavor)}{#if stepCount > 1}&nbsp;({question.index + 1} of
                    {stepCount}){/if}
            {/if}
        </h3>
        <div class="flex items-start gap-3">
            {#if question.kind === 'siteTake'}
                {#if siteCardId}
                    <span class="shrink-0">
                        <CardImage
                            cardId={siteCardId}
                            width={widthAtHeight(40, { cardId: siteCardId })}
                            inspect
                        />
                    </span>
                {/if}
            {:else}
                <img
                    class="h-10 w-20 shrink-0 rounded-[4px] object-cover shadow-md"
                    src={peoplesFavorImage}
                    alt={PEOPLES_FAVOR}
                    title={PEOPLES_FAVOR}
                    use:inspectImage={{
                        preview: { imageSrc: peoplesFavorImage, aspect: 2, label: PEOPLES_FAVOR }
                    }}
                />
            {/if}
            <div class="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Wake choices">
                {#if question.kind === 'favorStep'}
                    {#each question.options as option (option)}
                        {#if option === 'place'}
                            {@render choice('Place a favor', 'Place favor', () =>
                                wake.chooseKind('place')
                            )}
                        {:else}
                            {@render choice('Return a favor', 'Return favor', () =>
                                wake.chooseKind('return')
                            )}
                        {/if}
                    {/each}
                {:else if question.kind === 'returnBank'}
                    <SuitPicker
                        suits={question.banks}
                        picked={[]}
                        onpick={(suit) => wake.chooseBank(suit)}
                        {busy}
                    />
                {:else}
                    {#each question.takes as take (take)}
                        {@render choice(`Take a ${take}`, `Take ${take}`, () =>
                            wake.chooseSiteTake(take)
                        )}
                    {/each}
                    {@render choice('Take nothing', 'Take nothing', () =>
                        wake.chooseSiteTake(undefined)
                    )}
                {/if}
            </div>
        </div>
    {:else if wake.readyToEnd}
        <button
            class="min-h-11 rounded bg-oath-primary border-[1.5px] border-oath-primary-border px-4 py-1.5 text-[15px] font-semibold
                   text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40"
            disabled={busy || !!refusedBecause}
            onclick={() => wake.end()}
        >
            End Wake Phase
        </button>
    {/if}

    {#if refusedBecause}
        <p class="mt-2 text-[11px] text-oath-danger">
            <TokenText text={gameSession.humanizeReason(refusedBecause) ?? ''} />
        </p>
    {/if}
</div>
