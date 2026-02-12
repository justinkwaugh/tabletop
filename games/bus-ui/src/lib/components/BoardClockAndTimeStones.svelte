<script lang="ts">
    import { ActionType, MachineState } from '@tabletop/bus'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import {
        buildClockHandTransform,
        ClockHandAnimator,
        clockHandRotationDegreesForLocation
    } from '$lib/animators/clockHandAnimator.js'
    import {
        BUS_CLOCK_CENTER_POINT,
        BUS_TIME_STONE_BLUE_POINTS,
        BUS_TIME_STONE_GREEN_POINTS
    } from '$lib/definitions/busBoardGraph.js'
    import arrowImg from '$lib/images/arrow.svg'
    import timeStoneBlueImg from '$lib/images/time_stone_blue.svg'
    import timeStoneGreenImg from '$lib/images/time_stone_green.svg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const CLOCK_HAND_VIEWBOX_WIDTH = 66.9
    const CLOCK_HAND_VIEWBOX_HEIGHT = 30.18
    const CLOCK_HAND_PIVOT_X = 20.2
    const CLOCK_HAND_PIVOT_Y = 18.13
    const CLOCK_HAND_SCALE = 1.863
    const CLOCK_HAND_OFFSET_X = -1
    const CLOCK_HAND_OFFSET_Y = -2
    const CLOCK_HAND_WIDTH = CLOCK_HAND_VIEWBOX_WIDTH * CLOCK_HAND_SCALE
    const CLOCK_HAND_HEIGHT = CLOCK_HAND_VIEWBOX_HEIGHT * CLOCK_HAND_SCALE
    const CLOCK_HAND_ORIGIN_X =
        BUS_CLOCK_CENTER_POINT.x + CLOCK_HAND_OFFSET_X - CLOCK_HAND_PIVOT_X * CLOCK_HAND_SCALE
    const CLOCK_HAND_ORIGIN_Y =
        BUS_CLOCK_CENTER_POINT.y + CLOCK_HAND_OFFSET_Y - CLOCK_HAND_PIVOT_Y * CLOCK_HAND_SCALE
    const CLOCK_HAND_CENTER_X = BUS_CLOCK_CENTER_POINT.x + CLOCK_HAND_OFFSET_X
    const CLOCK_HAND_CENTER_Y = BUS_CLOCK_CENTER_POINT.y + CLOCK_HAND_OFFSET_Y
    const CLOCK_HAND_GEOMETRY = {
        originX: CLOCK_HAND_ORIGIN_X,
        originY: CLOCK_HAND_ORIGIN_Y,
        pivotX: CLOCK_HAND_PIVOT_X * CLOCK_HAND_SCALE,
        pivotY: CLOCK_HAND_PIVOT_Y * CLOCK_HAND_SCALE
    }

    const CLOCK_RIVET_RADIUS = 10.5
    const CLOCK_RIVET_OUTER_RADIUS = CLOCK_RIVET_RADIUS + 1.4

    const TIME_STONE_SIZE = 52
    const TIME_STONE_HALF_SIZE = TIME_STONE_SIZE / 2
    const TIME_STONE_SOCKET_RADIUS = TIME_STONE_HALF_SIZE
    const TIME_STONE_SOCKET_OPACITY = 0.7
    const TIME_STONE_MASK_OPACITY = 0.56
    const TIME_STONE_MASK_RADIUS = TIME_STONE_HALF_SIZE - 1.5
    const TIME_STONE_HIT_RADIUS = TIME_STONE_HALF_SIZE

    type TimeStoneKey = 'bottom-left' | 'bottom' | 'right' | 'top-right' | 'top-left'

    type TimeStoneRender = {
        key: TimeStoneKey
        point: { x: number; y: number }
        spriteHref: string
    }

    const TIME_STONE_RENDER_ORDER: readonly TimeStoneRender[] = [
        {
            key: 'bottom-left',
            point: BUS_TIME_STONE_BLUE_POINTS[2]!,
            spriteHref: timeStoneBlueImg
        },
        {
            key: 'bottom',
            point: BUS_TIME_STONE_GREEN_POINTS[1]!,
            spriteHref: timeStoneGreenImg
        },
        {
            key: 'right',
            point: BUS_TIME_STONE_BLUE_POINTS[1]!,
            spriteHref: timeStoneBlueImg
        },
        {
            key: 'top-right',
            point: BUS_TIME_STONE_GREEN_POINTS[0]!,
            spriteHref: timeStoneGreenImg
        },
        {
            key: 'top-left',
            point: BUS_TIME_STONE_BLUE_POINTS[0]!,
            spriteHref: timeStoneBlueImg
        }
    ]

    const TIME_STONE_CLICK_PRIORITY: readonly TimeStoneKey[] = [
        'top-left',
        'top-right',
        'right',
        'bottom',
        'bottom-left'
    ]

    const clockHandAnimator = new ClockHandAnimator(gameSession, CLOCK_HAND_GEOMETRY)

    const visibleTimeStones: TimeStoneRender[] = $derived.by(() => {
        const stoneCount = Math.max(
            0,
            Math.min(gameSession.gameState.stones, TIME_STONE_RENDER_ORDER.length)
        )
        return TIME_STONE_RENDER_ORDER.slice(0, stoneCount)
    })

    const canStopTimeFromStone = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.TimeMachine &&
            gameSession.validActionTypes.includes(ActionType.StopTime) &&
            visibleTimeStones.length > 0
        )
    })

    const selectableTimeStoneKey: TimeStoneKey | undefined = $derived.by(() => {
        if (!canStopTimeFromStone) {
            return undefined
        }

        const visibleStoneKeys = new Set(visibleTimeStones.map((stone) => stone.key))
        return TIME_STONE_CLICK_PRIORITY.find((key) => visibleStoneKeys.has(key))
    })

    const clockHandRotationDegrees = $derived.by(() => {
        return clockHandRotationDegreesForLocation(gameSession.gameState.currentLocation)
    })

    function handleTimeStoneChoose(stoneKey: TimeStoneKey) {
        if (!canStopTimeFromStone) {
            return
        }
        if (selectableTimeStoneKey !== stoneKey) {
            return
        }

        void gameSession.stopTime()
    }

    function handleActivateFromKeyboard(event: KeyboardEvent, action: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
            return
        }
        event.preventDefault()
        action()
    }
</script>

<defs>
    <filter id="clock-hand-depth" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow
            dx="0.9"
            dy="1.25"
            stdDeviation="0.8"
            flood-color="#000000"
            flood-opacity="0.5"
        ></feDropShadow>
        <feDropShadow
            dx="-0.45"
            dy="-0.55"
            stdDeviation="0.35"
            flood-color="#ffffff"
            flood-opacity="0.24"
        ></feDropShadow>
    </filter>
    <filter id="clock-hand-specular" x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.55" result="expanded-alpha"
        ></feMorphology>
        <feOffset in="expanded-alpha" dx="-0.15" dy="-0.95" result="shifted-alpha"></feOffset>
        <feComposite in="shifted-alpha" in2="SourceAlpha" operator="out" result="rim-alpha"
        ></feComposite>
        <feFlood flood-color="#ffffff" flood-opacity="0.5" result="specular-color"></feFlood>
        <feComposite in="specular-color" in2="rim-alpha" operator="in" result="specular-rim"
        ></feComposite>
        <feGaussianBlur in="specular-rim" stdDeviation="0.24"></feGaussianBlur>
    </filter>
    <linearGradient id="clock-hand-specular-mask-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="1"></stop>
        <stop offset="48%" stop-color="#ffffff" stop-opacity="0.42"></stop>
        <stop offset="78%" stop-color="#ffffff" stop-opacity="0"></stop>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
    </linearGradient>
    <mask id="clock-hand-specular-mask">
        <rect
            x="-8"
            y="-8"
            width={CLOCK_HAND_WIDTH + 16}
            height={CLOCK_HAND_HEIGHT + 16}
            fill="url(#clock-hand-specular-mask-gradient)"
        ></rect>
    </mask>
    <radialGradient id="clock-rivet-fill" cx="34%" cy="28%" r="74%">
        <stop offset="0%" stop-color="#525252"></stop>
        <stop offset="52%" stop-color="#222222"></stop>
        <stop offset="100%" stop-color="#080808"></stop>
    </radialGradient>
    <radialGradient id="clock-rivet-gloss" cx="30%" cy="25%" r="70%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"></stop>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
    </radialGradient>
</defs>

{#each TIME_STONE_RENDER_ORDER as stone (`socket:${stone.key}`)}
    <circle
        class="pointer-events-none"
        cx={stone.point.x}
        cy={stone.point.y}
        r={TIME_STONE_SOCKET_RADIUS}
        fill="#000000"
        opacity={TIME_STONE_SOCKET_OPACITY}
        aria-hidden="true"
    ></circle>
{/each}

{#each visibleTimeStones as stone (stone.key)}
    {@const isSelectable = canStopTimeFromStone && selectableTimeStoneKey === stone.key}
    {@const shouldMask = canStopTimeFromStone && !isSelectable}
    <image
        class="pointer-events-none"
        href={stone.spriteHref}
        x={stone.point.x - TIME_STONE_HALF_SIZE}
        y={stone.point.y - TIME_STONE_HALF_SIZE}
        width={TIME_STONE_SIZE}
        height={TIME_STONE_SIZE}
        aria-hidden="true"
    ></image>
    {#if shouldMask}
        <circle
            class="pointer-events-none"
            cx={stone.point.x}
            cy={stone.point.y}
            r={TIME_STONE_MASK_RADIUS}
            fill="#000000"
            opacity={TIME_STONE_MASK_OPACITY}
            aria-hidden="true"
        ></circle>
    {/if}
    {#if isSelectable}
        <circle
            class="time-stone-hit cursor-pointer"
            cx={stone.point.x}
            cy={stone.point.y}
            r={TIME_STONE_HIT_RADIUS}
            fill="transparent"
            role="button"
            tabindex="0"
            aria-label="Stop time"
            onkeydown={(event) =>
                handleActivateFromKeyboard(event, () => handleTimeStoneChoose(stone.key))}
            onclick={() => handleTimeStoneChoose(stone.key)}
        ></circle>
    {/if}
{/each}

<g
    {@attach attachAnimator(clockHandAnimator)}
    class="pointer-events-none"
    transform={buildClockHandTransform(CLOCK_HAND_GEOMETRY, clockHandRotationDegrees)}
    aria-hidden="true"
>
    <image
        href={arrowImg}
        width={CLOCK_HAND_WIDTH}
        height={CLOCK_HAND_HEIGHT}
        filter="url(#clock-hand-depth)"
    ></image>
    <image
        href={arrowImg}
        width={CLOCK_HAND_WIDTH}
        height={CLOCK_HAND_HEIGHT}
        filter="url(#clock-hand-specular)"
        mask="url(#clock-hand-specular-mask)"
        opacity="0.95"
    ></image>
</g>
<g class="pointer-events-none" aria-hidden="true">
    <circle
        cx={CLOCK_HAND_CENTER_X}
        cy={CLOCK_HAND_CENTER_Y}
        r={CLOCK_RIVET_OUTER_RADIUS}
        fill="#060606"
        opacity="0.85"
    ></circle>
    <circle
        cx={CLOCK_HAND_CENTER_X}
        cy={CLOCK_HAND_CENTER_Y}
        r={CLOCK_RIVET_RADIUS}
        fill="url(#clock-rivet-fill)"
        stroke="#000000"
        stroke-width="0.8"
    ></circle>
    <circle
        cx={CLOCK_HAND_CENTER_X - 1.2}
        cy={CLOCK_HAND_CENTER_Y - 1.35}
        r={CLOCK_RIVET_RADIUS * 0.55}
        fill="url(#clock-rivet-gloss)"
    ></circle>
</g>

<style>
    .time-stone-hit:focus {
        outline: none;
    }

    .time-stone-hit:focus-visible {
        outline: 2.5px solid #fff27a;
        outline-offset: 2px;
    }
</style>
