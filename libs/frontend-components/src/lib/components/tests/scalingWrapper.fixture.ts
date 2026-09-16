import './scalingWrapper.fixture.css'
import { mount } from 'svelte'
import Fixture from './ScalingWrapper.fixture.svelte'

export function mountWrapper(maxScale = 1) {
    mount(Fixture, { target: document.body, props: { maxScale } })
}
