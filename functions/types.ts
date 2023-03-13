export class Type {
    alternatives: Type[];
    _name: string;
    kind: 'generic' | 'primitive' | 'parametric' | 'record';

    constructor(name : string, kind: 'generic' | 'primitive' | 'parametric' | 'record', rest?: {alternatives: Type[]}) {
        this._name = name;
        this.alternatives = rest?.alternatives ?? [];
        this.kind = kind;
    }

    accepts(type: Type): boolean {
        if (this._accepts(type))
            return true;
        if (!type.alternatives)
            return false;
        console.log('checking alternatives', type.alternatives, 'for', this.toString())
        for (let alt of type.alternatives) {
            if (this.accepts(alt)) {
                console.log('yes, accepting alternative', alt.toString())
                return true;
            }
        }
        return false;
    }

    getAlternative(name: string): Type | undefined {
        if (this._name == name)
            return this;
        for (let alt of this.alternatives) {
            if (alt._name == name)
                return alt;
            let r = alt.getAlternative(name);
            if (r)
                return r;
        }
        return undefined;
    }

    _accepts(type: Type): boolean {
        return false;
    }

    toString(): string {
        return this._name;
    }
}

export class GenericType extends Type {
    generic : string;
    constructor(name: string) {
        super(name, 'generic');
        this.generic = name;
    }

    _accepts(type: Type): boolean {
        return false;
    }
}

export function Generic(name: string) {
    return new GenericType(name);
}
Generic.A = Generic('A');
Generic.B = Generic('B');
Generic.C = Generic('C');

export class PrimitiveType extends Type {
    constructor(name: string, rest?: {alternatives: Type[]}) {
        super(name, 'primitive', rest);
    }

    _accepts(type: Type): boolean {
        return type instanceof PrimitiveType && type._name == this._name;
    }
}

export class ParametricType extends Type {
    parameters: Type[];
    constructor(name: string, parameters : Type[], rest?: {alternatives: Type[]}) {
        super(name, 'parametric', rest);
        this.parameters = parameters;
    }

    _accepts(type: Type): boolean {
        if (!(type instanceof ParametricType))
            return false;
        if (type._name != this._name)
            return false;
        if (type.parameters.length != this.parameters.length && this.parameters.length > 0)
            return false;
        for (let i = 0; i < this.parameters.length; i++) {
            if (!this.parameters[i].accepts(type.parameters[i]))
                return false;
        }
        return true;
    }

    toString(): string {
        return `${this._name}<${this.parameters.map(x => x.toString()).join(', ')}>`;
    }
}

export class RecordType extends Type {
    fields: [string, Type][];
    fieldLookup: {[name: string]: Type};
    constructor(fields: [string, Type][]) {
        super('record', 'record');
        this.fields = fields;
        this.fieldLookup = {};
        for (let [name, type] of fields) {
            this.fieldLookup[name] = type;
        }
    }

    _accepts(type: Type): boolean {
        if (!(type instanceof RecordType))
            return false;
        console.log('checking fields')
        for (let [name, t] of this.fields) {
            console.log('checking', name)
            if (!(name in type.fieldLookup))
                return false;
            console.log('checking type', t.toString(), 'against', type.fieldLookup[name].toString())
            console.log('success: ', t.accepts(type.fieldLookup[name]))
            if (!t.accepts(type.fieldLookup[name]))
                return false;
        }
        console.log('returning success!', this.toString(), 'accepts', type.toString())
        return true;
    }

    toString() {
        return `record<${this.fields.map(([name, type]) => `${name}: ${type}`).join(', ')}>`;
    }
}

export function Stream(...types : Type[]) {
    return new ParametricType('stream', types);
}

export function fromString(typeStr : string) {
    switch (typeStr) {
        case "int": return int;
        case "float": return float;
        case "boolean": return boolean;
        case "colour": return colour;
        case "string": return string;
        case "timestamp": return timestamp;
    }
    return undefined;
}

export const int = new PrimitiveType('int');
export const float = new PrimitiveType('float');
export const string = new PrimitiveType('string');
export const colour = new PrimitiveType('colour', {alternatives: [new RecordType([['r', int], ['g', int], ['b', int]])]});
export const boolean = new PrimitiveType('boolean');
export const timestamp = new PrimitiveType('timestamp');
export const image = new PrimitiveType('image');

export const AnyStream = Stream();