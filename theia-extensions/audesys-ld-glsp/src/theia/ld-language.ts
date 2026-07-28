/**
 * LD Diagram Language — GLSP diagram type definition.
 *
 * Defines the contribution ID, diagram type, label, and file extensions
 * for the Ladder Diagram editor in the Theia workbench.
 */
import { GLSPDiagramLanguage } from '@eclipse-glsp/theia-integration/lib/common';

export const LdDiagramLanguage: GLSPDiagramLanguage = {
    contributionId: 'audesys-ld',
    label: 'Ladder Diagram',
    diagramType: 'ld-diagram',
    fileExtensions: ['.ld'],
};
