import { addons, types } from "storybook/manager-api"
import { ThemeTool } from "./theme-tool"

addons.register("openloop/theme-toggle", () => {
  addons.add("openloop/theme-toggle/tool", {
    type: types.TOOL,
    title: "Theme",
    match: ({ viewMode }) => viewMode === "story" || viewMode === "docs",
    render: ThemeTool,
  })
})
