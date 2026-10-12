import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  useAutomaticCallRecovery,
  isTransientCallCode,
} from "./use-automatic-call-recovery";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("continues with capped retry frequency and cancels on exit", async () => {
  const recover = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useAutomaticCallRecovery({
      enabled: true,
      needed: true,
      busy: false,
      recovered: false,
      recover,
    }),
  );
  for (const delay of [500, 1000, 2000, 4000])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(delay);
    });
  expect(recover).toHaveBeenCalledTimes(4);
  hook.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(recover).toHaveBeenCalledTimes(4);
});

it("waits for room readmission instead of joining a call on an unauthorized socket", async () => {
  const recover = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(
    ({ enabled }) =>
      useAutomaticCallRecovery({
        enabled,
        needed: true,
        busy: false,
        recovered: false,
        recover,
      }),
    { initialProps: { enabled: false } },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(recover).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(recover).toHaveBeenCalledOnce();
});

it("does not classify invalid membership or payload as transient", () => {
  expect(isTransientCallCode("JOIN_CALL_TIMEOUT")).toBe(true);
  for (const code of [
    "ROOM_EXPIRED",
    "INVALID_CALL_JOINED_RESPONSE",
    "PARTICIPANT_NOT_LINKED_TO_ROOM",
    "PERMISSION_DENIED",
  ])
    expect(isTransientCallCode(code)).toBe(false);
});
