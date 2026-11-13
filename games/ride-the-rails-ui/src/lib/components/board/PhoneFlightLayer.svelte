<script lang="ts">
    import type { Flyer as FlyerShape } from '$lib/animators/flights.svelte.js'
    import {
        BOARD_ATTRIBUTE,
        frameOf,
        frameTransform,
        readableBoost
    } from '$lib/animators/flightPlaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import Flyer from './Flyer.svelte'

    const flights = getGameSession().flights

    /** What stays on the map: drawn only where the board shows. */
    const ON_THE_MAP: ReadonlySet<FlyerShape['kind']> = new Set([
        'outline',
        'line',
        'passenger',
        'pulse'
    ])
    const CLIP_ID = 'rtr-phone-flight-clip'

    /** Coins and a share's locomotive, drawn no smaller than they can be read. */
    function readable(flyer: FlyerShape): boolean {
        return flyer.kind === 'coin' || (flyer.kind === 'locomotive' && flyer.leavesTheMap === true)
    }

    const onMap = $derived(flights.flyers.filter((flyer) => ON_THE_MAP.has(flyer.kind)))
    const travelling = $derived(flights.flyers.filter((flyer) => !ON_THE_MAP.has(flyer.kind)))

    /** What clips the board on screen: the nearest of its boxes that hides its overflow. */
    function boardClipper(board: Element): Element | undefined {
        const window = board.ownerDocument.defaultView
        for (let element = board.parentElement; element; element = element.parentElement) {
            if (window?.getComputedStyle(element).overflow !== 'visible') {
                return element
            }
        }
        return undefined
    }

    /**
     * While anything flies, keeps the flyers' board units on the board as it is drawn on screen
     * now, and the map's own flyers inside the board's view. Each frame reads the boxes before it
     * writes, so the browser lays out once.
     */
    function followBoard(svg: SVGSVGElement) {
        if (flights.flyers.length === 0) return
        const boardSvg = svg.ownerDocument.querySelector(`svg[${BOARD_ATTRIBUTE}]`)
        const clipper = boardSvg ? boardClipper(boardSvg) : undefined
        const boardUnits = svg.querySelectorAll('[data-board-units]')
        const clip = svg.querySelector(`#${CLIP_ID} rect`)
        let frame = 0
        const place = () => {
            const box = boardSvg?.getBoundingClientRect()
            const view = clipper?.getBoundingClientRect()
            const board = box && frameOf(box)
            if (board) {
                for (const group of boardUnits) {
                    group.setAttribute('transform', frameTransform(board))
                }
                for (const group of svg.querySelectorAll('[data-readable]')) {
                    group.setAttribute('transform', `scale(${readableBoost(board)})`)
                }
            }
            if (view && clip) {
                clip.setAttribute('x', String(view.left))
                clip.setAttribute('y', String(view.top))
                clip.setAttribute('width', String(view.width))
                clip.setAttribute('height', String(view.height))
            }
            frame = requestAnimationFrame(place)
        }
        place()
        return () => cancelAnimationFrame(frame)
    }
</script>

<!-- Contract, Phone layout: phones show the railroad strip, the round badge and the money outside
     the board, so the flyers are drawn above the whole table, in the board's units, and land there. -->
{#if isPhoneWidth()}
    <svg class="phone-flights" aria-hidden="true" pointer-events="none" {@attach followBoard}>
        <defs>
            <clipPath id={CLIP_ID} clipPathUnits="userSpaceOnUse">
                <rect x="0" y="0" width="0" height="0"></rect>
            </clipPath>
        </defs>
        <g clip-path="url(#{CLIP_ID})">
            <g data-board-units>
                {#each onMap as flyer (flyer.key)}
                    <Flyer {flyer} />
                {/each}
            </g>
        </g>
        <g data-board-units>
            {#each travelling as flyer (flyer.key)}
                <Flyer {flyer} readable={readable(flyer)} />
            {/each}
        </g>
    </svg>
{/if}

<style>
    .phone-flights {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        z-index: 40;
    }
</style>
