<script lang="ts">
    import type { Point } from '@tabletop/common'

    let {
        id = 'dropshadow',
        width = '130%',
        height = '130%',
        offset = { x: 2, y: 2 },
        amount = 1
    }: { id?: string; width?: string; height?: string; offset?: Point; amount?: number } = $props()
</script>

<filter {id} {width} {height}>
    <feGaussianBlur in="SourceAlpha" stdDeviation={amount} result="shadow"></feGaussianBlur>
    <feOffset dx={offset.x} dy={offset.y}></feOffset>
</filter>
