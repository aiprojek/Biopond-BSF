import './index.css';
import {registerSW} from 'virtual:pwa-register';
import * as sanitizers from './core/sanitizers';
import * as backupCrypto from './core/backupCrypto';
import * as syncHelpers from './core/syncHelpers';
import * as metrics from './core/metrics';

declare global {
  interface Window {
    BSFCore?: typeof sanitizers & typeof backupCrypto & typeof syncHelpers & typeof metrics;
  }
}

window.BSFCore = {
  ...sanitizers,
  ...backupCrypto,
  ...syncHelpers,
  ...metrics,
};

registerSW({
  immediate: true,
});
