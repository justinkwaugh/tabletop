<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.2, R-7.4 — on a phone the seats sit off the screen's left edge. While a card on the
    // seat whose turn it is (an adviser or a relic) has a "Use" and the seat is off screen, one
    // gold "Use" on the screen's edge, beside the seat, stands for them all; a tap slides the
    // seat in, as a swipe does. Ringed while one of them is.
    let gameSession = getGameSession()

    let seatId = $derived(gameSession.liveTurnSeatId)
    let seatCards = $derived.by(() => {
        if (!seatId) return []
        const seat = gameSession.gameState.getPlayerState(seatId)
        return [...seat.faceupAdviserIds(), ...seat.relicIds]
    })
    let onSeat = $derived(gameSession.useCards.filter((cardId) => seatCards.includes(cardId)))
    let ringed = $derived(gameSession.ringedUses.some((cardId) => seatCards.includes(cardId)))

    // The tap area's distance below the seat's top, and its size.
    const BELOW_SEAT_TOP = 72
    const SIZE = 44

    let place = $state<{ left: number; top: number } | undefined>(undefined)
    let scroller: HTMLElement | undefined

    $effect(() => {
        const id = seatId
        if (!id || onSeat.length === 0) {
            place = undefined
            return
        }
        const found = document.querySelector<HTMLElement>('.table-scroller') ?? undefined
        if (!found) {
            place = undefined
            return
        }
        scroller = found
        const selector = `[data-seat="${CSS.escape(id)}"]`
        let seat: HTMLElement | null = null
        let frame = 0
        // The Players tab draws the seats only while it is open, so a visit to another tab
        // and back draws a new seat: each read finds the seat again and measures that one.
        const read = () => {
            const now = found.querySelector<HTMLElement>(selector)
            if (now !== seat) {
                if (seat) resized.unobserve(seat)
                seat = now
                if (seat) resized.observe(seat)
            }
            if (!seat) {
                place = undefined
                return
            }
            const view = found.getBoundingClientRect()
            const rect = seat.getBoundingClientRect()
            if (rect.left >= view.left - 0.5 && rect.right <= view.right + 0.5) {
                place = undefined
                return
            }
            const top = Math.min(Math.max(rect.top + BELOW_SEAT_TOP, view.top), view.bottom - SIZE)
            place = { left: view.left, top }
        }
        const later = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(read)
        }
        const resized = new ResizeObserver(later)
        resized.observe(found)
        // A seat drawn or taken away (the Players tab opened or left) reads again.
        const drawn = new MutationObserver(() => {
            if (!seat?.isConnected) later()
        })
        drawn.observe(found, { childList: true, subtree: true })
        found.addEventListener('scroll', later, { passive: true })
        window.addEventListener('resize', later)
        read()
        return () => {
            cancelAnimationFrame(frame)
            resized.disconnect()
            drawn.disconnect()
            found.removeEventListener('scroll', later)
            window.removeEventListener('resize', later)
        }
    })

    function slideIn() {
        scroller?.scrollTo({ left: 0, behavior: 'smooth' })
    }
</script>

{#if place}
    <button
        type="button"
        class="seat-use-tag"
        class:seat-use-tag--ring={ringed}
        style:left="{place.left}px"
        style:top="{place.top}px"
        aria-label="Your cards"
        aria-describedby={ringed ? gameSession.useRingReason : undefined}
        data-seat-use-tag
        onclick={slideIn}
    >
        <span class="seat-use-tag__face" aria-hidden="true">Use</span>
    </button>
{/if}

<style>
    .seat-use-tag {
        position: fixed;
        z-index: 6;
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
    }
    .seat-use-tag__face {
        padding: 3px 6px;
        border-radius: 5px;
        background: #facc15;
        color: #1c1917;
        font-size: 12px;
        font-weight: 800;
        line-height: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
    .seat-use-tag:hover .seat-use-tag__face {
        background: #fde047;
    }
    /* R-7.4 — a card on the seat would make the dimmed action possible. */
    .seat-use-tag--ring .seat-use-tag__face {
        box-shadow:
            0 0 0 2px #1c1917,
            0 0 0 4px #fcd34d;
    }
</style>
