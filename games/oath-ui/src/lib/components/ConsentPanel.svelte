<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
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

    // R-6.6.2, R-9.3 — which warbands become Imperial is the Exile's choice
    // when the Empire cannot cover them all.
    let groups = $derived(consent.groups)
    let imperialAvailable = $derived(consent.imperialAvailable)
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

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
        A question for you
    </h3>

    {#if !pending}
        <p class="text-sm text-oath-text-muted">Nothing is waiting on an answer.</p>
    {:else if !iAmAsked}
        <p class="text-sm text-oath-text-muted">
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
            <p class="mb-2 text-[11px] text-oath-danger">
                {gameSession.humanizeReason(grantBlockedBecause)}
            </p>
        {/if}
        <div class="flex gap-2">
            <button
                class="grow rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !!grantBlockedBecause}
                onclick={() => gameSession.answerConsent(true)}
            >
                {asked.request.kind === ConsentRequestKind.JoinDefence ? 'Join' : 'Allow'}
            </button>
            <button
                class="grow rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
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

        <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
            <div class="text-oath-text-muted mb-1">The binding exchange</div>
            <div>
                They also give: <TokenText
                    text={transferText(
                        gameState,
                        request.terms?.fromScepterHolder,
                        pending.askingPlayerId
                    )}
                />
            </div>
            <div>
                You give: <TokenText
                    text={transferText(gameState, request.terms?.fromExile, pending.askedPlayerId)}
                />
            </div>
        </div>

        <p class="mb-2 text-[11px] text-oath-text-muted leading-snug">
            Accepting flips your board to its Citizen side, makes your warbands Imperial, discards
            your revealed Vision and refreshes your Supply. Refusing changes nothing at all.
        </p>

        {#if mustChoose}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">
                    The Empire has only {imperialAvailable} Imperial warbands for
                    {forceTotal(groups)} of yours. Choose which are replaced — exactly
                    {imperialAvailable}, and the rest stay your own.
                </div>
                {#each groups as group, index (JSON.stringify(group.at) + group.owner)}
                    <div class="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span class="w-56 max-sm:w-full"
                            >{gameSession.warbandOwnerName(group.owner)} {whereText(group)}</span
                        >
                        <CountPicker
                            values={range(0, group.count + 1)}
                            picked={picked[index] ?? 0}
                            label={(n) =>
                                `${n} of the ${gameSession.warbandOwnerName(group.owner)} warbands ${whereText(group)}`}
                            onpick={(n) => consent.setPicked(index, n)}
                            disabled={busy}
                        />
                    </div>
                {/each}
                <div
                    class={pickedTotal === imperialAvailable
                        ? 'text-oath-text-muted'
                        : 'text-oath-danger'}
                >
                    Chosen {pickedTotal} of {imperialAvailable}
                </div>
            </div>
        {/if}

        {#if blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(blockedBecause) ?? ''} />
            </p>
        {/if}

        <div class="flex gap-2">
            <button
                class="grow rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !!blockedBecause}
                onclick={() => consent.answer(true)}
            >
                Accept Citizenship
            </button>
            <button
                class="grow rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy}
                onclick={() => consent.answer(false)}
            >
                Refuse
            </button>
        </div>
    {/if}
</div>
