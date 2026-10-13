<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { FAVOR_BANK_ORDER } from '@tabletop/oath'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { bannerPreview } from '$lib/model/bannerPreview.js'
    import { tappedCount } from '$lib/model/exchangeTerms.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bannerName, bannerTokenKind } from '$lib/model/names.js'

    // R-5.4.2 the bid, beside the picked banner's tile (ringed as picked; the tile is not a
    // button, its magnifier enlarges it); R-5.4.4 the bank the People's Favor's old favor starts
    // returning to.
    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let banner = $derived(gameSession.stagedBanner)
    let amounts = $derived(gameSession.bannerAmounts)
    let reason = $derived(gameSession.bannerRecoverReason)
    let secret = $derived(banner !== undefined && bannerTokenKind(banner) === 'secret')
    let token = $derived(secret ? 'secrets' : 'favor')
    // R-5.4.2 — "any amount … greater than its current value": the tokens held, those under the
    // least bid paid with it and never tappable alone.
    let least = $derived(amounts[0] ?? 0)
    let held = $derived(amounts[amounts.length - 1] ?? 0)
    let picked = $derived(gameSession.bannerAmount ?? least)
</script>

{#if banner}
    {@const preview = bannerPreview(gameSession.gameState, banner)}
    <div class="flex flex-col gap-1.5 text-xs">
        <div class="flex items-center gap-3.5">
            <span class="relative inline-flex shrink-0">
                <img
                    src={preview.imageSrc}
                    alt=""
                    class="h-14 w-28 rounded-[4px] ring-2 ring-oath-accent max-[359px]:h-11 max-[359px]:w-[88px]"
                />
                <Magnifier {preview} label={preview.label} />
            </span>
            <div class="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-start">
                <span class="text-sm font-semibold"
                    ><TokenText text="{bannerName(banner)}: pay how many {token}?" /></span
                >
                <TokenRow
                    image={secret ? secretToken() : favorToken()}
                    {held}
                    addable={held}
                    {picked}
                    floor={least}
                    label={(amount) => `pay ${amount} ${token}`}
                    ontap={(amount) =>
                        gameSession.setBannerAmount(tappedCount(picked, amount, least))}
                    {busy}
                />
            </div>
        </div>
        {#if gameSession.needsFavorStart}
            <div class="text-sm">
                <TokenText text="Return its favor, starting at:" />
            </div>
            {@const start = gameSession.favorStart}
            <SuitPicker
                suits={FAVOR_BANK_ORDER}
                picked={start === undefined ? [] : [start]}
                onpick={(suit) => gameSession.setFavorStart(suit)}
                {busy}
            />
        {/if}
        {#if reason && gameSession.bannerPicksComplete}
            <p class="text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
            </p>
        {/if}
        {#if !reason}
            <button
                class="rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 self-start max-sm:min-h-11 max-sm:px-4"
                disabled={busy}
                aria-label="Recover the {bannerName(banner)}"
                onclick={() => gameSession.recoverBanner()}
            >
                Recover
            </button>
        {/if}
    </div>
{/if}
