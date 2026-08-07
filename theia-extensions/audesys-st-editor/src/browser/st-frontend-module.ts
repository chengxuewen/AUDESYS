/**
 * ST Editor Frontend Module
 *
 * Registers the Structured Text language contribution and the ST compile
 * command (F7 → compile via backend napi-rs bridge → Monaco diagnostics).
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, KeybindingContribution } from '@theia/core/lib/browser';
import { StLanguageContribution } from './st-language-contribution';
import { StCompileCommandContribution } from './st-compile-command';

export default new ContainerModule((bind) => {
    bind(FrontendApplicationContribution).to(StLanguageContribution);
    // One singleton shared by both contribution interfaces — execute() and
    // onStart() must act on the SAME instance (inversify would otherwise
    // create two copies and compileServer stays null on the command one).
    bind(StCompileCommandContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(StCompileCommandContribution);
    bind(KeybindingContribution).toService(StCompileCommandContribution);
    bind(FrontendApplicationContribution).toService(StCompileCommandContribution);
});
