<script lang="ts">
    import { onMount } from 'svelte'
    import { BuildingType } from '@tabletop/urbino'
    import { placementAnim, type PlacementAnimRequest } from '$lib/model/animationStore'

    const svgNS = 'http://www.w3.org/2000/svg'

    function buildPaths(type: BuildingType): string[] {
        if (type === BuildingType.House) return [
            'M 2.5,4.75 L 17.5,4.75 L 19,9.25 L 1,9.25 Z',
            'M 1,9.25 L 19,9.25 L 19,15.25 L 1,15.25 Z',
        ]
        if (type === BuildingType.Palace) return [
            'M 1,11.5 L 19,11.5 L 19,17.5 L 1,17.5 Z',
            'M 10,2.5 L 19,11.5 L 1,11.5 Z',
            'M 2.5,7 L 10,2.25 L 10,5.5 L 1,11.5 Z',
            'M 10,2.25 L 17.5,7 L 19,11.5 L 10,5.5 Z',
        ]
        return [
            'M 2.3,8.7 L 17.7,8.7 L 17.7,19 L 2.3,19 Z',
            'M 10,4.1 L 17.2,8.7 L 17.2,10.3 L 2.8,10.3 L 2.8,8.7 Z',
            'M 3.6,4.9 L 10,1 L 10,3.6 L 2.3,8.7 Z',
            'M 10,1 L 16.4,4.9 L 17.2,8.7 L 10,3.6 Z',
        ]
    }

    function animate(req: PlacementAnimRequest) {
        const isTower = req.buildingType === BuildingType.Tower
        const size = 42

        const container = document.createElement('div')
        Object.assign(container.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '10000',
            left: `${req.fromRect.left + req.fromRect.width / 2}px`,
            top: `${req.fromRect.top + req.fromRect.height / 2}px`,
            transform: 'translate(-50%, -50%)',
        })

        const svg = document.createElementNS(svgNS, 'svg')
        svg.setAttribute('viewBox', '0 0 20 20')
        svg.setAttribute('width', String(size))
        svg.setAttribute('height', String(isTower ? Math.round(size * 1.1) : size))
        if (isTower) svg.setAttribute('preserveAspectRatio', 'none')
        svg.setAttribute('fill', req.playerColor)
        svg.setAttribute('stroke', '#483737')
        svg.setAttribute('stroke-width', '1')
        svg.setAttribute('stroke-linejoin', 'round')
        svg.style.filter = 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))'

        for (const d of buildPaths(req.buildingType)) {
            const path = document.createElementNS(svgNS, 'path')
            path.setAttribute('d', d)
            svg.appendChild(path)
        }
        container.appendChild(svg)
        document.body.appendChild(container)

        const fromCx = req.fromRect.left + req.fromRect.width / 2
        const fromCy = req.fromRect.top + req.fromRect.height / 2
        const toCx = req.toRect.left + req.toRect.width / 2
        const toCy = req.toRect.top + req.toRect.height / 2
        const dx = toCx - fromCx
        const dy = toCy - fromCy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const arcH = Math.max(60, dist * 0.4)

        const tx = (f: number) => `${dx * f}`
        const ty = (f: number, arc: number) => `${dy * f - arcH * arc}`

        const anim = container.animate(
            [
                { transform: 'translate(-50%, -50%) scale(1)', offset: 0 },
                {
                    transform: `translate(calc(-50% + ${tx(0.15)}px), calc(-50% + ${ty(0.15, 0.55)}px)) scale(1.3)`,
                    offset: 0.2,
                },
                {
                    transform: `translate(calc(-50% + ${tx(0.5)}px), calc(-50% + ${ty(0.5, 1)}px)) scale(1.5)`,
                    offset: 0.5,
                },
                {
                    transform: `translate(calc(-50% + ${tx(0.85)}px), calc(-50% + ${ty(0.85, 0.3)}px)) scale(1.25)`,
                    offset: 0.78,
                },
                {
                    transform: `translate(calc(-50% + ${tx(1)}px), calc(-50% + ${ty(1, 0)}px)) scale(0.82)`,
                    offset: 0.87,
                },
                {
                    transform: `translate(calc(-50% + ${tx(1)}px), calc(-50% + ${ty(1, 0)}px)) scale(1.1)`,
                    offset: 0.93,
                },
                {
                    transform: `translate(calc(-50% + ${tx(1)}px), calc(-50% + ${ty(1, 0)}px)) scale(1)`,
                    offset: 1,
                },
            ],
            { duration: 594, easing: 'linear', fill: 'none' }
        )

        anim.onfinish = () => container.remove()
    }

    onMount(() => {
        placementAnim.register(animate)
        return () => placementAnim.unregister()
    })
</script>
