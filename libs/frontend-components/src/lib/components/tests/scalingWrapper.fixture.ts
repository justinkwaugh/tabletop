import './scalingWrapper.fixture.css'
import { mount } from 'svelte'
import Fixture from './ScalingWrapper.fixture.svelte'

export function mountWrapper() {
    mount(Fixture, { target: document.body })
}
