/**
 * Workshop Playground — Browser Entry Point
 *
 * This is the module that Theia loads when it discovers the
 * "frontend" entry in package.json's `theiaExtensions` array.
 *
 * It imports the ContainerModule (the DI binding config) and
 * the Monarch tokenizer registration.
 *
 * IMPORTANT: The frontend module module itself does NOT call
 * createAudESYSConfigMonarchLanguage(). That must be done after
 * Monaco is loaded. For a full extension, you'd use a
 * FrontendApplicationContribution or a MonacoContribution.
 * For this workshop, the tokenizer is a reference example.
 */

import frontendModule from './workshop-playground-frontend-module';
import { createAudESYSConfigMonarchLanguage } from './audesys-config-language';

export default frontendModule;

// Re-export the language creation function
export { createAudESYSConfigMonarchLanguage };
