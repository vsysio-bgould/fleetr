/**
 * BullMQ custom job IDs cannot contain ":" because that separator is reserved
 * for internal repeat/delay keys. Encode dynamic fragments before composing IDs.
 */
export function bullMqJobId(prefix: string, value: string | number): string {
  const encoded = encodeURIComponent(String(value)).replace(/%/g, "_");
  return `${prefix}-${encoded}`;
}
