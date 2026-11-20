import "@testing-library/jest-dom";
import { vi } from "vitest";

// No network in tests: stub fetch and WebSocket so live feeds stay idle.
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("network disabled in tests")))
);
class FakeSocket {
  readyState = 0;
  send() {}
  close() {}
}
vi.stubGlobal("WebSocket", FakeSocket);
