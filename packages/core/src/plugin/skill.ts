/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeOpencodeContent from "./skill/customize-openloop.md" with { type: "text" }

export const CustomizeOpenloopContent = customizeOpencodeContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-openloop",
            description:
              "Use ONLY when the user is editing or creating openloop's own configuration: openloop.json, openloop.jsonc, files under .openloop/, or files under ~/.config/openloop/. Also use when creating or fixing openloop agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring openloop itself.",
            location: AbsolutePath.make("/builtin/customize-openloop.md"),
            content: CustomizeOpenloopContent,
          }),
        }),
      )
    })
  }),
})
