export const APP_INFO = {
  name: 'MBT: My Budget Tracker',
  version: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
  buildDate: typeof __BUILD_DATE__ === 'undefined' ? '' : __BUILD_DATE__,
  commit: typeof __COMMIT__ === 'undefined' ? 'dev' : __COMMIT__,
  /** Сайт MBT (budget-spec, spec/05 «О приложении»): лендинг, инструкция, исходный код. */
  siteUrl: 'https://lendel.app/mbt/',
  guideUrl: 'https://lendel.app/mbt/docs/',
} as const
