import { useActor as useCoreActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";
import type { backendInterface } from "../backend";

/**
 * Project-level wrapper: binds the generated createActor to the
 * core-infrastructure useActor hook so callers need no arguments.
 */
export function useActor(): {
  actor: backendInterface | null;
  isFetching: boolean;
} {
  return useCoreActor(createActor) as {
    actor: backendInterface | null;
    isFetching: boolean;
  };
}
