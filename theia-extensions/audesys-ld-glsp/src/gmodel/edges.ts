/**
 * LD GModel — Edge type definitions for IEC 61131-3 Ladder Diagram.
 *
 * Edges represent the electrical connections between ladder diagram
 * elements: wires between contacts/coils and power connections
 * between power rails and rung elements.
 */

import { Point } from './nodes';

// ============================================================================
// Base Edge
// ============================================================================

/**
 * Base graph edge — compatible with GLSP `GEdge`.
 *
 * Every connection in the graph model extends this interface.
 * The `type` discriminator uses GLSP's `edge:<kind>` convention.
 */
export interface BaseEdge {
  /** Unique identifier within the graph (UUID v4) */
  id: string;
  /** GLSP edge type discriminator, e.g. "edge:wire" */
  type: string;
  /** ID of the source node */
  sourceId: string;
  /** ID of the target node */
  targetId: string;
  /** Optional CSS class names for styling */
  cssClasses?: string[];
}

// ============================================================================
// Wire Connection
// ============================================================================

/**
 * Wire connection between two ladder diagram elements.
 *
 * Represents a horizontal wire within a rung that passes power flow
 * from one element to the next (left-to-right). Wires can be re-routed
 * manually via routing points.
 *
 * In GLSP, this is an `edge:wire` element.
 */
export interface WireConnection extends BaseEdge {
  type: 'edge:wire';
  /**
   * Manual routing waypoints for non-straight wire paths.
   * When undefined or empty, the wire is drawn as a straight line
   * between source and target (auto-routed by the layout engine).
   */
  routingPoints?: Point[];
}

// ============================================================================
// Power Connection
// ============================================================================

/**
 * Power connection from a power rail to a rung element.
 *
 * These are always straight horizontal connections from the left rail
 * to the first element on a rung, or from the last element to the
 * right rail. They do not support routing points.
 *
 * In GLSP, this is an `edge:power` element.
 */
export interface PowerConnection extends BaseEdge {
  type: 'edge:power';
}
