<script lang="ts">
    import { useThrelte, useTask } from '@threlte/core'
    import { onMount } from 'svelte'
    import {
        EffectComposer,
        EffectPass,
        KernelSize,
        OutlineEffect,
        RenderPass,
        SelectiveBloomEffect
    } from 'postprocessing'
    import type { Camera } from 'three'
    import { HalfFloatType } from 'three'
    import { getContext } from 'svelte'
    import type { Effects } from '$lib/model/Effects.svelte'

    const { scene, renderer, camera, size, renderStage, invalidate } = useThrelte()
    const effects = getContext<Effects>('effects')

    // Adapt the default WebGLRenderer: https://github.com/pmndrs/postprocessing#usage
    const composer = new EffectComposer(renderer, {
        frameBufferType: HalfFloatType
    })
    const setupEffectComposer = (camera: Camera) => {
        composer.removeAllPasses()
        composer.addPass(new RenderPass(scene, camera))
        const bloomEffect = new SelectiveBloomEffect(scene, camera, {
            intensity: 5,
            mipmapBlur: true,
            luminanceThreshold: 0,
            luminanceSmoothing: 0.2,
            radius: 0.3,
            resolutionScale: 4
        })
        composer.addPass(new EffectPass(camera, bloomEffect))

        const outlineEffect = new OutlineEffect(scene, camera, {
            multisampling: Math.min(4, renderer.capabilities.maxSamples),
            edgeStrength: 6,
            pulseSpeed: 0,
            visibleEdgeColor: 0xffffff,
            hiddenEdgeColor: 0xffffff,
            height: 480,
            blur: true,
            xRay: false,
            kernelSize: KernelSize.VERY_SMALL
        })

        composer.addPass(new EffectPass(camera, outlineEffect))

        const pulseOutlineEffect = new OutlineEffect(scene, camera, {
            multisampling: Math.min(4, renderer.capabilities.maxSamples),
            edgeStrength: 6,
            pulseSpeed: 0.35,
            visibleEdgeColor: 0xffffff,
            hiddenEdgeColor: 0x888888,
            height: 480,
            blur: true,
            xRay: false,
            kernelSize: KernelSize.SMALL
        })

        composer.addPass(new EffectPass(camera, pulseOutlineEffect))

        effects.bloom = bloomEffect
        effects.outline = outlineEffect
        effects.pulseOutline = pulseOutlineEffect
    }
    onMount(() => {
        setupEffectComposer(camera.current)
        const unsubscribe = size.subscribe(({ width, height }) => {
            composer.setSize(width, height)
            invalidate()
        })
        return () => {
            unsubscribe()
            composer.dispose()
        }
    })

    useTask(
        (delta) => {
            composer.render(delta)
        },
        { stage: renderStage, autoInvalidate: false }
    )
</script>
