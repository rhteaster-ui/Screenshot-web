import type { Plugin } from "vite";

export function sites(_options?: { mockAuth?: boolean }): Plugin {
  return {
    name: "sites-stub-plugin",
  };
}
