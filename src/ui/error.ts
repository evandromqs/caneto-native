import * as Crypto from 'expo-crypto';

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string' && err.message) {
      if (typeof err.hint === 'string' && err.hint) {
        return `${err.message} (${err.hint})`;
      }
      return err.message;
    }
    if (typeof err.error_description === 'string' && err.error_description) return err.error_description;
    if (typeof err.details === 'string' && err.details) return err.details;
    if (typeof err.error === 'string' && err.error) return err.error;
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch {
      // fallback
    }
  }
  return String(error);
}

export function generateUUID(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      const id = Crypto.randomUUID();
      if (id && typeof id === 'string') return id;
    }
  } catch {
    // fallback to Math.random implementation
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
