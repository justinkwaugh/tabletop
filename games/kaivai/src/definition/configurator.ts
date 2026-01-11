import { assert, BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { KaivaiGameConfig, KaivaiGameConfigOptions } from './gameConfig.js'

export class KaivaiConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = KaivaiGameConfig
    options = KaivaiGameConfigOptions

    updateConfig(
        config: KaivaiGameConfig,
        update: { id: string; value: string | boolean | number | null }
    ) {
        super.updateConfig(config, update)
        if (update.id === 'lucklessFishing' && update.value) {
            config.lessluckFishing = false
        } else if (update.id === 'lessluckFishing' && update.value) {
            config.lucklessFishing = false
        }
    }

    validateConfig(config: KaivaiGameConfig) {
        assert(
            !(config.lucklessFishing && config.lessluckFishing),
            'Cannot enable both luckless and lessluck fishing'
        )
        super.validateConfig(config)
    }
}
