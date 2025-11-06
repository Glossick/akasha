// Validation utilities for graph operations

export function validateLabel(label: string): { valid: boolean; error?: string } {
  if (!label || typeof label !== 'string') {
    return { valid: false, error: 'Label is required and must be a string' };
  }
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(label)) {
    return {
      valid: false,
      error: 'Label must start with uppercase letter and contain only alphanumeric characters and underscores',
    };
  }
  return { valid: true };
}

export function validateRelationshipType(type: string): { valid: boolean; error?: string } {
  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Relationship type is required and must be a string' };
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(type)) {
    return {
      valid: false,
      error: 'Relationship type must be uppercase alphanumeric with underscores',
    };
  }
  return { valid: true };
}

export function validateEntityId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Entity ID is required and must be a string' };
  }
  if (id.trim().length === 0) {
    return { valid: false, error: 'Entity ID cannot be empty' };
  }
  return { valid: true };
}

