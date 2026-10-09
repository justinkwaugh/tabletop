<script lang="ts">
    import { CardKind, PeekTargetKind } from '@tabletop/oath'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { cardBack } from '$lib/images/cardImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.3 — a row per relic at the site the player has not seen; a seen one shows its face.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let slots = $derived(gameSession.peekSlots)
    let busy = $derived(gameSession.busy)
    const choiceWidth = new ChoiceWidth()
    let siteId = $derived(gameSession.myPlayerState?.siteId)
    let order = $derived(siteId ? gameState.relicSlotsAt(siteId).map((slot) => slot.slotId) : [])

    const nameOf = (slotId: string) => `Facedown relic, space ${order.indexOf(slotId) + 1}`
</script>

{#if slots.length === 0}
    <p class="text-xs text-oath-text-muted">Nothing to peek at.</p>
{:else}
    <div class="flex flex-col gap-1.5" role="list" aria-label="Relics to peek at">
        {#each slots as slotId (slotId)}
            <MenuRow
                image={cardBack(CardKind.Relic)}
                imageAlt=""
                name={nameOf(slotId)}
                shape="relic"
                points={{ kind: 'relic', slotId }}
            >
                <MenuChoice
                    label="Peek at {nameOf(slotId).toLowerCase()}"
                    disabled={busy}
                    width={choiceWidth}
                    onclick={() =>
                        gameSession.choosePeek({ kind: PeekTargetKind.SiteRelic, slotId })}
                >
                    Look
                </MenuChoice>
            </MenuRow>
        {/each}
    </div>
{/if}
