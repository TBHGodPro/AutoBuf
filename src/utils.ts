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
};

export function capitalize(string: string): string {
  return string.substring(0, 1).toUpperCase() + string.substring(1);
}

export function randomString(length: number = 1): string {
  const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

  let string = '';

  for (let i = 0; i < length; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)];
    string += Math.random() < 0.5 ? char.toLowerCase() : char.toUpperCase();
  }

  return string;
}
