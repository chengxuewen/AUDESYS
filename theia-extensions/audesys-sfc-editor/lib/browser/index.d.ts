/**
 * SFC Editor — Browser Entry Point
 *
 * Called by Theia when it loads the "frontend" entry in
 * package.json's `theiaExtensions` array.
 *
 * The ContainerModule registers:
 *   - Monarch tokenizer via MonacoContribution
 *   - SFC language definition (.sfc file extension)
 */
import frontendModule from './sfc-frontend-module';
import { createSfcMonarchLanguage } from './sfc-language';
import { SFC_LANGUAGE_ID, SFC_FILE_EXTENSIONS } from './sfc-contribution';
export default frontendModule;
export { createSfcMonarchLanguage, SFC_LANGUAGE_ID, SFC_FILE_EXTENSIONS, };
//# sourceMappingURL=index.d.ts.map