/**
 * FBD Theia Diagram Configuration — client-side diagram type registration.
 *
 * Specifies the diagram type identifier that the GLSP client uses to
 * match incoming GModel data to the correct diagram editor.
 */
import { ContainerConfiguration, IDiagramOptions, initializeDiagramContainer } from '@eclipse-glsp/client';
import { GLSPDiagramConfiguration } from '@eclipse-glsp/theia-integration/lib/browser';
import { Container } from '@theia/core/shared/inversify';
import { FbdDiagramLanguage } from './fbd-language';
import fbdGlspClientModule from '../client/fbd-glsp-client-module';

export class FbdTheiaDiagramConfiguration extends GLSPDiagramConfiguration {
    get diagramType(): string {
        return FbdDiagramLanguage.diagramType;
    }

    override configureContainer(container: Container, ...containerConfiguration: ContainerConfiguration): void {
        initializeDiagramContainer(container, fbdGlspClientModule, ...containerConfiguration);
    }
}
