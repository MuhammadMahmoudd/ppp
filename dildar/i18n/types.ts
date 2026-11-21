/** Deep-maps a strings object to "same keys, any string" so translations must match. */
export type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Helper for section files: `export default section(ckb, en)`. */
export function section<T>(ckb: T, en: Widen<T>): { ckb: T; en: Widen<T> } {
  return { ckb, en };
}
