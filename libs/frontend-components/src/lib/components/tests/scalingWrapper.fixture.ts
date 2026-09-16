import './scalingWrapper.fixture.css'
import { mount } from 'svelte'
import Fixture from './ScalingWrapper.fixture.svelte'

export function mountWrapper(maxScale = 1, scrollable = false) {
    mount(Fixture, { target: document.body, props: { maxScale, scrollable } })
}
