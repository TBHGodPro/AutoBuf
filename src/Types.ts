export type ProtocolSpec = {
  [name: string]: {
    id: number;
    data: ProtocolSpecData;
    direction: 'incoming' | 'outgoing' | 'both';
  };
};

export type ProtocolSpecData = {
  [key: string]:
    | ProtocolSpecRegularDataType
    | {
        type: ProtocolSpecRegularDataType;
      }
    | {
        type: ProtocolSpecSpecialDataType;
        data: ProtocolSpecData;
      }
    | {
        type: 'array';
        data: ProtocolSpecRegularDataType;
      }
    | {
        type: 'object';
        keyType: ProtocolSpecRegularDataType;
        valueType: ProtocolSpecData[keyof ProtocolSpecData];
      }
    | {
        type: 'enum';
        name: string;
        values: string[];
      };
};

export const ProtocolSpecRegularDataTypes = ['varInt', 'string', 'int', 'long', 'stringArray', 'intArray', 'bytes', 'boolean', 'float', 'short', 'double'] as const;
export type ProtocolSpecRegularDataType = (typeof ProtocolSpecRegularDataTypes)[number];
export const ProtocolSpecSpecialDataTypes = ['array', 'object', 'enum'] as const;
export type ProtocolSpecSpecialDataType = (typeof ProtocolSpecSpecialDataTypes)[number];
export const ProtocolSpecAllDataTypes = [...ProtocolSpecRegularDataTypes, ...ProtocolSpecSpecialDataTypes] as const;
export type ProtocolSpecAllDataType = (typeof ProtocolSpecAllDataTypes)[number];

export function isValidProtocolSpec(spec: ProtocolSpec): spec is ProtocolSpec {
  if (!spec || typeof spec !== 'object') return false;

  for (const key in spec) {
    if (typeof key !== 'string') return false;

    if (typeof spec[key].id !== 'number') return false;
    if (!['incoming', 'outgoing', 'both'].includes(spec[key].direction)) return false;
    if (!isValidProtocolSpecData(spec[key].data)) return false;
  }

  return true;
}
export function isValidProtocolSpecData(data: ProtocolSpecData): data is ProtocolSpecData {
  if (!data || typeof data !== 'object') return false;

  for (const key in data) {
    if (typeof key !== 'string') return false;

    const item = data[key];
    if (!item) return false;

    if (typeof item === 'string') {
      if (!ProtocolSpecRegularDataTypes.includes(item)) return false;
    } else if (typeof item === 'object') {
      if (!ProtocolSpecAllDataTypes.includes(item.type)) return false;

      if (ProtocolSpecSpecialDataTypes.includes(item.type as any)) {
        if ((item as any).data) {
          if (item.type !== 'array' || !ProtocolSpecRegularDataTypes.includes((item as any).data)) {
            if (!isValidProtocolSpecData((item as any).data)) return false;
          }
        } else if ((item as any).keyType && (item as any).valueType) {
          if (!ProtocolSpecRegularDataTypes.includes((item as any).keyType)) return false;
          if (
            !isValidProtocolSpecData({
              placeholder: (item as any).valueType,
            })
          )
            return false;
        } else if (item.type === 'enum') {
          if (typeof (item as any).name !== 'string') return false;
          if (!Array.isArray((item as any).values)) return false;
          if ((item as any).values.map(i => typeof i === 'string').includes(false)) return false;
        } else return false;
      }
    } else return false;
  }

  return true;
}
