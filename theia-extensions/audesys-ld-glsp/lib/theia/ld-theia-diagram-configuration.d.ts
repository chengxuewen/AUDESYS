/**
 * LD Theia Diagram Configuration — client-side diagram type registration.
 *
 * Specifies the diagram type identifier that the GLSP client uses to
 * match incoming GModel data to the correct diagram editor.
 */
import { ContainerConfiguration } from '@eclipse-glsp/client';
import { GLSPDiagramConfiguration } from '@eclipse-glsp/theia-integration/lib/browser';
import { Container } from '@theia/core/shared/inversify';
export declare class LdTheiaDiagramConfiguration extends GLSPDiagramConfiguration {
    get diagramType(): string;
    configureContainer(container: Container, ...containerConfiguration: ContainerConfiguration): void;
}
//# sourceMappingURL=ld-theia-diagram-configuration.d.ts.map