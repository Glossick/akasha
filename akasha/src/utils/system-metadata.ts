/**
 * System metadata generator for Akasha
 * 
 * This utility generates system-level metadata that is automatically applied
 * to entities, relationships, and documents. It provides a patternized approach
 * to adding metadata, making it easy to extend in future iterations.
 * 
 * System metadata is separate from domain data (extracted from text) and
 * represents information about when/how facts were recorded in the system.
 */

export interface SystemMetadataOptions {
  scopeId?: string;
  contextId: string;
  timestamp: Date;
  validFrom?: Date | string;
  validTo?: Date | string;
}

/**
 * Generate system metadata for entities, relationships, and documents
 * 
 * System metadata includes:
 * - scopeId: Isolation boundary (if provided)
 * - contextIds: Array of context IDs this fact belongs to
 * - _recordedAt: ISO timestamp when fact was recorded (always automatic)
 * - _validFrom: ISO timestamp when fact becomes valid (defaults to _recordedAt)
 * - _validTo: ISO timestamp when fact becomes invalid (optional, null = ongoing)
 * 
 * @param options - System metadata generation options
 * @returns Record of system metadata properties
 */
export function generateSystemMetadata(
  options: SystemMetadataOptions
): Record<string, unknown> {
  const recordedAt = options.timestamp.toISOString();
  
  // Default validFrom to recordedAt if not provided
  const validFrom = options.validFrom
    ? typeof options.validFrom === 'string'
      ? options.validFrom
      : options.validFrom.toISOString()
    : recordedAt;

  const metadata: Record<string, unknown> = {
    ...(options.scopeId ? { scopeId: options.scopeId } : {}),
    contextIds: [options.contextId],
    _recordedAt: recordedAt,
    _validFrom: validFrom,
  };

  // Only include _validTo if explicitly provided
  if (options.validTo) {
    metadata._validTo =
      typeof options.validTo === 'string'
        ? options.validTo
        : options.validTo.toISOString();
  }

  return metadata;
}

