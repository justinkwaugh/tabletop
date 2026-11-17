<script lang="ts">
    import type { Flyer as FlyerShape } from '$lib/animators/flights.svelte.js'
    import {
        boardBoxOf,
        boardIn,
        frameOf,
        frameTransform,
        onTheMap,
        readableBoost
    } from '$lib/animators/flightPlaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import { tableOf } from '$lib/utils/tableScope.js'
    import Flyer from './Flyer.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const CLIP_ID = 'rtr-table-flight-clip'

    /** On a phone, coins and a share's locomotive are drawn no smaller than they can be read. */
    function readable(flyer: FlyerShape): boolean {
        return (
            isPhoneWidth() &&
            (flyer.kind === 'coin' || (flyer.kind === 'locomotive' && flyer.leavesTheMap === true))
        )
    }

    // Wider screens draw the map's own flyers in the board (FlightLayer); phones draw them here,
    // clipped to the board's view, so they share one frame with the rest.
    const onMap = $derived(isPhoneWidth() ? flights.flyers.filter(onTheMap) : [])
    const travelling = $derived(flights.flyers.filter((flyer) => !onTheMap(flyer)))
    const flying = $derived(flights.flyers.length > 0)

    /**
     * What clips the board on screen: the nearest of its boxes in the title's table that hides its
     * overflow.
     */
    function boardClipper(board: Element, table: Element): Element | undefined {
        const window = board.ownerDocument.defaultView
        for (
            let element = board.parentElement;
            element && table.contains(element);
            element = element.parentElement
        ) {
            if (window?.getComputedStyle(element).overflow !== 'visible') {
                return element
            }
        }
        return undefined
    }

    function write(element: Element, name: string, value: string) {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value)
    }

    /**
     * While anything flies, keeps the flyers' board units on the board as it is drawn on screen
     * now, and the map's own flyers inside the board's view. Each frame reads the boxes before it
     * writes, and writes only what moved, so the browser lays out at most once.
     */
    function followBoard(svg: SVGSVGElement) {
        if (!flying) return
        const table = tableOf(svg)
        const boardSvg = boardIn(table)
        const clipper = boardSvg && table ? boardClipper(boardSvg, table) : undefined
        const boardUnits = svg.querySelectorAll('[data-board-units]')
        const clip = svg.querySelector(`#${CLIP_ID} rect`)
        let frame = 0
        const place = () => {
            const box = boardSvg && boardBoxOf(boardSvg)
            const view = clipper?.getBoundingClientRect()
            const board = box && frameOf(gameSession.boardFrame, box)
            if (board) {
                const transform = frameTransform(board)
                for (const group of boardUnits) {
                    write(group, 'transform', transform)
                }
                const boost = `scale(${readableBoost(board)})`
                for (const group of svg.querySelectorAll('[data-readable]')) {
                    write(group, 'transform', boost)
                }
            }
            if (view && clip) {
                write(clip, 'x', String(view.left))
                write(clip, 'y', String(view.top))
                write(clip, 'width', String(view.width))
                write(clip, 'height', String(view.height))
            }
            frame = requestAnimationFrame(place)
        }
        place()
        return () => cancelAnimationFrame(frame)
    }
</script>

<!-- Contract, Animation plan: the supply piles, the seat cards and the Transcontinental chip sit
     beside the board, so the locomotives and coins that fly to and from them are drawn above the
     whole table, in the board's units. -->
<svg class="table-flights" aria-hidden="true" pointer-events="none" {@attach followBoard}>
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

<style>
    .table-flights {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        z-index: 40;
    }
</style>
