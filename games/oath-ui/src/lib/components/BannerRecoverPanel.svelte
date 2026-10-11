<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { FAVOR_BANK_ORDER } from '@tabletop/oath'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bannerName, bannerTokenKind } from '$lib/model/names.js'

    // R-5.4.2 the bid; R-5.4.4 the bank the People's Favor's old favor starts returning to.
    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let banner = $derived(gameSession.stagedBanner)
    let amounts = $derived(gameSession.bannerAmounts)
    let reason = $derived(gameSession.bannerRecoverReason)
    let token = $derived(banner && bannerTokenKind(banner) === 'secret' ? 'secrets' : 'favor')
</script>

{#if banner}
    <div class="flex flex-col gap-1.5 text-xs">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-oath-text-muted"
                ><TokenText text="Pay for the {bannerName(banner)} in {token}:" /></span
            >
            <CountPicker
                values={amounts}
                picked={gameSession.bannerAmount}
                label={(amount) => `pay ${amount} ${token}`}
                onpick={(amount) => gameSession.setBannerAmount(amount)}
                disabled={busy}
            />
        </div>
        {#if gameSession.needsFavorStart}
            <div class="text-oath-text-muted">
                <TokenText text="Return the favor on it starting at:" />
            </div>
            {@const start = gameSession.favorStart}
            <SuitPicker
                suits={FAVOR_BANK_ORDER}
                picked={start === undefined ? [] : [start]}
                onpick={(suit) => gameSession.setFavorStart(suit)}
                {busy}
            />
        {/if}
        {#if reason}
            <p class="text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
            </p>
        {/if}
        <button
            class="rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 self-start"
            disabled={busy || !!reason}
            onclick={() => gameSession.recoverBanner()}
        >
            Recover the {bannerName(banner)}
        </button>
    </div>
{/if}
