import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import './vars.css'
import './overrides.css'
import 'uno.css'

const config: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.config.globalProperties.$spec = {
      version: '2.0',
    }
  },
}

export default config
