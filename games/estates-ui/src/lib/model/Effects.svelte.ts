import type { OutlineEffect, SelectiveBloomEffect } from 'postprocessing'

export class Effects {
    bloom: SelectiveBloomEffect | undefined = $state()
    outline: OutlineEffect | undefined = $state()
}
