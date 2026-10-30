<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, ChronicleStep, type Suit } from '@tabletop/oath'
    import AnswerButtons from '$lib/components/AnswerButtons.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import ChooseOathPanel from '$lib/components/ChooseOathPanel.svelte'
    import ChronicleStory from '$lib/components/ChronicleStory.svelte'
    import PlayerChips from '$lib/components/PlayerChips.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import { addedBySuit } from '$lib/model/chronicleDrafts.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-8 — the step the chronicle waits on, for the seat it waits on; every other seat reads
    // "Waiting on" above this panel. A step that does not stop never shows.
    let gameSession = getGameSession()
    let chronicle = $derived(gameSession.gameState.chronicle)
    let busy = $derived(gameSession.busy)
    let valid = $derived(gameSession.validActionTypes)

    let offer = $derived(gameSession.chronicleOffer)
    let build = $derived(gameSession.chronicleBuild)
    let suit = $derived(gameSession.chronicleSuit)
    let heal = $derived(gameSession.healStack)

    const PRIMARY =
        'rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold'
    const SECONDARY =
        'rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-3 py-1.5 text-sm font-semibold'

    function healAdds(stack: Suit) {
        return [{ suit: stack, count: heal.count }]
    }
</script>

{#snippet confirm(onclick: () => void)}
    <div class="buttons mt-2">
        <button type="button" class={PRIMARY} disabled={busy} {onclick}>Confirm</button>
    </div>
{/snippet}

<div class="mb-2" data-chronicle-step={chronicle?.step}>
    {#if chronicle?.step === ChronicleStep.Vow}
        <ChooseOathPanel />
    {:else if chronicle?.step === ChronicleStep.Citizenship}
        {#if valid.includes(ActionType.OfferChronicleCitizenship)}
            <p class="mb-2 text-sm">Offer Citizenship to:</p>
            <PlayerChips
                playerIds={offer.eligible}
                picked={offer.picked}
                onpick={(playerId) => offer.toggle(playerId)}
                {busy}
            />
            <div class="buttons mt-2">
                {#if offer.picked.length > 0}
                    <button
                        type="button"
                        class={PRIMARY}
                        disabled={busy}
                        onclick={() => offer.offer()}>Offer</button
                    >
                {/if}
                <button
                    type="button"
                    class={SECONDARY}
                    disabled={busy}
                    onclick={() => offer.noOffer()}>No offer</button
                >
            </div>
        {:else}
            <!-- R-8.2 sets the usual terms aside (R-6.6.1): the offer alone. -->
            <p class="mb-2 text-sm">
                <PlayerName playerId={chronicle.ending.winnerPlayerId} /> offers you Citizenship.
            </p>
            <AnswerButtons
                {busy}
                onanswer={(accept) => gameSession.answerChronicleCitizenship(accept)}
            />
        {/if}
    {:else if chronicle?.step === ChronicleStep.BuildOrRepair}
        {@const pointed = build.pointed}
        <p class="mb-2 text-sm">
            {build.repairOffered ? 'Build or repair an edifice.' : 'Build an edifice.'}
        </p>
        {#if pointed}
            <!-- What would stand there: the denizen's suit's edifice, or the ruin's intact side. -->
            <div class="mb-2" data-build-preview={pointed.edificeId}>
                <CardImage cardId={pointed.edificeId} intact inspect width={96} />
            </div>
        {/if}
        <div class="buttons">
            {#if pointed}
                <button
                    type="button"
                    class={PRIMARY}
                    disabled={busy}
                    onclick={() => build.confirm()}>{pointed.repair ? 'Repair' : 'Build'}</button
                >
            {/if}
            <button type="button" class={SECONDARY} disabled={busy} onclick={() => build.none()}
                >None</button
            >
        </div>
    {:else if chronicle?.step === ChronicleStep.Suit}
        <p class="mb-2 text-sm">Add to the world deck:</p>
        <SuitPicker
            suits={suit.suits}
            picked={suit.picked ? [suit.picked] : []}
            onpick={(chosen) => suit.pick(chosen)}
            {busy}
            framed
            adds={addedBySuit}
        />
        {#if suit.picked}
            {@render confirm(() => suit.confirm())}
        {/if}
    {:else if chronicle?.step === ChronicleStep.HealStack}
        <p class="mb-2 text-sm">Heal the Archive from:</p>
        <SuitPicker
            suits={heal.suits}
            picked={heal.picked ? [heal.picked] : []}
            onpick={(chosen) => heal.pick(chosen)}
            {busy}
            framed
            adds={healAdds}
        />
        {#if heal.picked}
            {@render confirm(() => heal.confirm())}
        {/if}
    {:else if chronicle?.step === ChronicleStep.Story}
        <ChronicleStory />
    {/if}
</div>

<style>
    /* A group of buttons shares its widest width, and each is 44 px tall on a phone. */
    .buttons {
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        gap: 0.5rem;
    }
    @media (max-width: 639px) {
        .buttons button {
            min-height: 44px;
        }
    }
</style>
