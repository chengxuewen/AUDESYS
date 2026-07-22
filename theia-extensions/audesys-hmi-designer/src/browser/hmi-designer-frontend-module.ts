/**
 * Theia Frontend Module for the HMI Designer extension.
 *
 * Registers the HMI Designer as a Theia widget via ReactWidget.
 * ponytail: single command + widget factory for the tool.
 */
import { ContainerModule } from "@theia/core/shared/inversify";
import { CommandContribution } from "@theia/core";
import { WidgetFactory } from "@theia/core/lib/browser";
import { Command, CommandRegistry } from "@theia/core/lib/common";
import { HmiDesignerWidget } from "./hmi-designer/hmi-designer-widget";

// ponytail: CSS injected via style tag in widget onAfterAttach (avoids esbuild .css resolution)
export const OPEN_HMI_DESIGNER: Command = {
  id: "audesys-hmi:open-designer",
  label: "HMI Designer",
};

export default new ContainerModule((bind) => {
  bind(CommandContribution).to(HmiDesignerCommandContribution);
  bind(WidgetFactory).toDynamicValue(ctx => ({
    id: "hmi-designer",
    createWidget: () => ctx.container.get(HmiDesignerWidget),
  }));
  bind(HmiDesignerWidget).toSelf();
});

class HmiDesignerCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(OPEN_HMI_DESIGNER, {
      execute: () => { /* widget opened via factory */ },
    });
  }
}

