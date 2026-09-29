<script lang="ts">
    import { siteName, transferText } from '$lib/model/names.js'
    import { ConsentRequestKind, forceTotal, type WarbandGroup } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { consentQuestion } from '$lib/model/consentRequests.js'

    // R-X.1 — another player's permission is explicit action input,
    // asked as a decision turn; refusing is a first-class answer.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let me = $derived(gameSession.myPlayer)
    let consent = $derived(gameSession.consent)
    let busy = $derived(gameSession.busy)

    let pending = $derived(gameState.pendingConsent)
    let isCitizenshipOffer = $derived(pending?.request.kind === ConsentRequestKind.CitizenshipOffer)
    let iAmAsked = $derived(!!me && pending?.askedPlayerId === me.id)
    let asked = $derived(gameSession.consentAsked)
    let grantBlockedBecause = $derived(gameSession.consentGrantBlockedBecause)

    let request = $derived(
        pending?.request.kind === ConsentRequestKind.CitizenshipOffer ? pending.request : undefined
    )

    // R-6.6.2, R-9.3 — which warbands take the purple is the Exile's choice
    // when the Empire cannot cover them all.
    let groups = $derived(consent.groups)
    let purpleAvailable = $derived(consent.purpleAvailable)
    let mustChoose = $derived(consent.mustChoose)
    let picked = $derived(consent.picked)
    let pickedTotal = $derived(consent.pickedTotal)

    let blockedBecause = $derived(consent.blockedBecause)

    function whereText(group: WarbandGroup): string {
        return group.at.kind === 'board'
            ? 'on your board'
            : `at ${siteName(gameState, group.at.siteId)}`
    }
</script>

<div class="rounded-lg bg-stone-900/70 border border-amber-500/40 px-3 py-2 text-stone-100">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">
        A question for you
    </h3>

    {#if !pending}
        <p class="text-sm text-stone-400">Nothing is waiting on an answer.</p>
    {:else if !iAmAsked}
        <p class="text-sm text-stone-300">
            Waiting on {gameSession.getPlayerName(pending.askedPlayerId)} to answer
            {gameSession.getPlayerName(pending.askingPlayerId)}{isCitizenshipOffer
                ? '’s offer of Citizenship'
                : ''}.
        </p>
    {:else if asked}
        <p class="text-sm mb-2">
            {consentQuestion(gameState, asked, (id) => gameSession.getPlayerName(id))}
        </p>
        {#if grantBlockedBecause}
            <p class="mb-2 text-[11px] text-rose-300">{grantBlockedBecause}</p>
        {/if}
        <div class="flex gap-2">
            <button
                class="grow rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !!grantBlockedBecause}
                onclick={() => gameSession.answerConsent(true)}
            >
                {asked.request.kind === ConsentRequestKind.JoinDefence ? 'Join' : 'Allow'}
            </button>
            <button
                class="grow rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy}
                onclick={() => gameSession.answerConsent(false)}
            >
                {asked.request.kind === ConsentRequestKind.JoinDefence ? 'Stay out' : 'Refuse'}
            </button>
        </div>
    {:else if request}
        <p class="text-sm mb-2">
            <span class="font-semibold">{gameSession.getPlayerName(pending.askingPlayerId)}</span>
            offers you Citizenship, and the relic in {request.reliquarySlotId}.
        </p>

        <div class="mb-2 rounded border border-stone-700 px-2 py-1.5 text-xs">
            <div class="text-stone-400 mb-1">The binding exchange</div>
            <div>
                They also give: {transferText(
                    gameState,
                    request.terms?.fromScepterHolder,
                    pending.askingPlayerId
                )}
            </div>
            <div>
                You give: {transferText(gameState, request.terms?.fromExile, pending.askedPlayerId)}
            </div>
        </div>

        <p class="mb-2 text-[11px] text-stone-400 leading-snug">
            Accepting flips your board to its Citizen side, turns your warbands purple, discards
            your revealed Vision and refreshes your Supply. Refusing changes nothing at all.
        </p>

        {#if mustChoose}
            <div class="mb-2 rounded border border-amber-500/40 px-2 py-1.5 text-xs">
                <div class="mb-1">
                    The Empire has only {purpleAvailable} purple for
                    {forceTotal(groups)} warbands. Choose which are replaced — exactly
                    {purpleAvailable}, and the rest stay your colour.
                </div>
                {#each groups as group, index (JSON.stringify(group.at) + group.color)}
                    <label class="block mb-1">
                        {picked[index] ?? 0} of {group.count}
                        {group.color}
                        {whereText(group)}
                        <input
                            disabled={busy}
                            type="range"
                            min="0"
                            max={group.count}
                            value={picked[index] ?? 0}
                            oninput={(event) =>
                                consent.setPicked(index, Number(event.currentTarget.value))}
                            class="w-full"
                        />
                    </label>
                {/each}
                <div class={pickedTotal === purpleAvailable ? 'text-stone-400' : 'text-rose-300'}>
                    Chosen {pickedTotal} of {purpleAvailable}
                </div>
            </div>
        {/if}

        {#if blockedBecause}
            <p class="mb-2 text-[11px] text-rose-300">{blockedBecause}</p>
        {/if}

        <div class="flex gap-2">
            <button
                class="grow rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !!blockedBecause}
                onclick={() => consent.answer(true)}
            >
                Accept Citizenship
            </button>
            <button
                class="grow rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy}
                onclick={() => consent.answer(false)}
            >
                Refuse
            </button>
        </div>
    {/if}
</div>
