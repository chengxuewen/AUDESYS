export type {
  IPlatformAdapter,
  PlatformMode,
  PlatformCapabilities,
  FileDialogOptions,
  FileDialogFilter,
} from "./types";

export {
  PlatformNotAvailableError,
  WebBackendError,
} from "./types";

export { PcAdapter } from "./pc-adapter";
export { WebAdapter } from "./web-adapter";
export type { WebAdapterConfig } from "./web-adapter";
export { PlatformProvider, usePlatform } from "./provider";
