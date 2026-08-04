import { describe, test, type TestOptions } from "bun:test"
import { which } from "@opencode-ai/core/util/which"

export function commandAvailable(name: string) {
  return which(name) !== null
}

export const describeGit = commandAvailable("git") ? describe : describe.skip

const rgCommand = process.platform === "win32" ? "rg.exe" : "rg"
export const describeRg = commandAvailable(rgCommand) ? describe : describe.skip
