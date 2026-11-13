/**
 * Re-export of the platform-provided Internet Identity hook.
 * This thin wrapper keeps imports consistent across the project:
 *   import { useInternetIdentity } from '../hooks/useInternetIdentity';
 */
export {
  useInternetIdentity,
  type InternetIdentityContext,
  type Status,
} from "@caffeineai/core-infrastructure";
