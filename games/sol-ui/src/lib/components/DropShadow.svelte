<script lang="ts">
    import type { Point } from '@tabletop/common'

    let {
        id = 'dropshadow',
        x = '-15%',
        y = '-15%',
        width = '130%',
        height = '130%',
        offset = { x: 2, y: 2 },
        amount = 1,
        source = 'alpha'
    }: {
        id?: string
        x?: string
        y?: string
        width?: string
        height?: string
        offset?: Point
        amount?: number
        source?: 'alpha' | 'graphic'
    } = $props()
</script>

<filter {id} {x} {y} {width} {height}>
    <feGaussianBlur
        in={source === 'alpha' ? 'SourceAlpha' : 'SourceGraphic'}
        stdDeviation={amount}
        result="shadow"
    ></feGaussianBlur>
    <feOffset dx={offset.x} dy={offset.y}></feOffset>
</filter>
