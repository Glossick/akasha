/**
 * Generate a text representation of an entity for embedding generation
 */
export function generateEntityText(entity: {
  label: string;
  properties: Record<string, unknown>;
}): string {
  const parts: string[] = [];

  // Add label
  parts.push(entity.label);

  // Add name/title (most important identifier)
  const name = entity.properties.name || entity.properties.title;
  if (name) {
    parts.push(String(name));
  }

  // Add description if available
  if (entity.properties.description) {
    parts.push(String(entity.properties.description));
  }

  // Add other relevant properties (excluding internal/technical fields)
  const excludeKeys = ['id', 'embedding', 'createdAt', 'updatedAt', 'scopeId', '_similarity'];
  for (const [key, value] of Object.entries(entity.properties)) {
    if (!excludeKeys.includes(key) && value !== name && value !== entity.properties.description) {
      if (typeof value === 'string' && value.length > 0 && value.length < 200) {
        parts.push(`${key}: ${value}`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        parts.push(`${key}: ${value}`);
      }
    }
  }

  return parts.join(' ');
}

