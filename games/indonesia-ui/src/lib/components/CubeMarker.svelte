<script lang="ts">
    import { gsap } from 'gsap'
    import CubeIcon from '$lib/images/CubeIcon.svelte'

    let {
        x,
        y,
        size = 16,
        color = '#6b7280',
        rotationDegrees = 0
    }: {
        x: number
        y: number
        size?: number
        color?: string
        rotationDegrees?: number
    } = $props()

    const CUBE_MOVE_DURATION = 0.28

    function cubeTransform(x: number, y: number, rotationDegrees: number): string {
        return `translate(${x} ${y}) rotate(${rotationDegrees})`
    }

    function animateCubePosition(
        node: SVGGElement,
        params: { x: number; y: number; rotationDegrees: number }
    ): {
        update: (next: { x: number; y: number; rotationDegrees: number }) => void
        destroy: () => void
    } {
        const state = {
            x: params.x,
            y: params.y,
            rotationDegrees: params.rotationDegrees
        }

        node.setAttribute('transform', cubeTransform(state.x, state.y, state.rotationDegrees))

        return {
            update(next) {
                if (
                    state.x === next.x &&
                    state.y === next.y &&
                    state.rotationDegrees === next.rotationDegrees
                ) {
                    return
                }

                gsap.killTweensOf(state)
                gsap.to(state, {
                    x: next.x,
                    y: next.y,
                    rotationDegrees: next.rotationDegrees,
                    duration: CUBE_MOVE_DURATION,
                    ease: 'power2.out',
                    onUpdate: () => {
                        node.setAttribute(
                            'transform',
                            cubeTransform(state.x, state.y, state.rotationDegrees)
                        )
                    }
                })
            },
            destroy() {
                gsap.killTweensOf(state)
            }
        }
    }
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    <g use:animateCubePosition={{ x, y, rotationDegrees }}>
        <CubeIcon x={-size / 2} y={-size / 2} width={size} height={size} fill={color} />
    </g>
</g>
