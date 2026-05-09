export const EMBEDDING_DIMENSIONS = 3072;

export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${values.length}`,
    );
  }

  return `[${values.map(formatVectorNumber).join(',')}]`;
}

function formatVectorNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Embedding contains a non-finite number');
  }

  return String(value);
}
