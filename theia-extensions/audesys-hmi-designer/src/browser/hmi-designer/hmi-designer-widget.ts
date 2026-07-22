/**
 * HmiDesignerWidget — Theia ReactWidget wrapping HmiDesignerTool.
 *
 * ponytail: thin wrapper around HmiDesignerTool to integrate with Theia dock panel.
 */
import * as React from "react";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import { Message } from "@theia/core/lib/browser/widgets/widget";
import { injectable, postConstruct } from "@theia/core/shared/inversify";

import HmiDesignerTool from "./hmi-designer-tool";

@injectable()
export class HmiDesignerWidget extends ReactWidget {
  static readonly ID = "hmi-designer";

  constructor() {
    super();
    this.id = HmiDesignerWidget.ID;
    this.title.label = "HMI Designer";
    this.title.closable = true;
    this.addClass("hmiapp-widget");
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    // ponytail: inject critical CSS (C3 z-index fix, C4 containment)
    const styleId = "audesys-hmi-critical-css";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .hmiapp-canvas .react-resizable-handle { z-index: 2147483647 !important; }
        .hmiapp-canvas { contain: layout style; overscroll-behavior: contain; }
      `;
      document.head.appendChild(style);
    }
  }

  @postConstruct()
  protected init(): void {
    this.update();
  }

  protected render(): React.ReactNode {
    return React.createElement(HmiDesignerTool, {
      onSaveYaml: (yaml: string) => this.handleSave(yaml),
      onLoadYaml: () => this.handleLoad(),
      onDeploy: (yaml: string) => this.handleDeploy(yaml),
    });
  }

  private handleSave(_yaml: string): Promise<void> {
    // ponytail: save via file dialog or service — stub for now
    return Promise.resolve();
  }

  private handleLoad(): Promise<string | null> {
    // ponytail: load via file dialog — stub for now
    return Promise.resolve(null);
  }

  private handleDeploy(_yaml: string): Promise<void> {
    // ponytail: deploy via IPC/napi-rs — stub for now
    return Promise.resolve();
  }
}
