export const typeMappings = {
  varInt: 'number',
  string: 'string',
  int: 'number',
  long: 'number',
  stringArray: 'string[]',
  intArray: 'number[]',
  bytes: 'Buffer',
  boolean: 'boolean',
  float: 'number',
  short: 'number',
  double: 'number',
  UUID: 'string',
  blob: 'Buffer',
};

export function capitalize(string: string): string {
  return string.substring(0, 1).toUpperCase() + string.substring(1);
}

const chars = ['i', 'e', 'x', 'a', 'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'y', 'z'];
let nextChar = 0;
export function getNextChar(): string {
  const char = chars[nextChar];
  nextChar++;
  return char;
}
export function resetNextChar() {
  nextChar = 0;
}
