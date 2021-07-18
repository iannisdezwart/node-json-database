export abstract class DataTypeClass<T> {
	public value: T

	constructor(value: T) {
		this.value = value
	}

	abstract compare(other: DataTypeClass<T>): boolean
}

interface DataTypeClassConstructor<T> {
	new (value: T): DataTypeClass<T>
}

export const dataTypes: {
	[ keys: string ]: DataTypeClassConstructor<any>
} = {
	Int: class DataType_Int extends DataTypeClass<number> {
		constructor(value: number) {
			if (value != null) {
				value = ~~value
			}

			super(value)
		}

		compare(int: DataType_Int) {
			return this.value > int.value
		}
	},
	Float: class DataType_Float extends DataTypeClass<number> {
		constructor(value: number) {
			super(value)
		}

		compare(float: DataType_Float) {
			return this.value > float.value
		}
	},
	Binary: class DataType_Binary extends DataTypeClass<number> {
		constructor(value: string) {
			if (value.replace('0', '').replace('1', '') == '') {
				throw new Error(`Cannot convert "${ value }" to binary. Expected only 0's and 1's`)
			}

			super(parseInt(value, 2))
		}

		compare(binary: DataType_Binary) {
			return this.value > binary.value
		}
	},
	Boolean: class DataType_Boolean extends DataTypeClass<boolean> {
		constructor(value: boolean) {
			super(value)
		}

		compare(boolean: DataType_Boolean) {
			return this.value > boolean.value
		}
	},
	DateTime: class DataType_DateTime extends DataTypeClass<number> {
		constructor(value: number) {
			super(value)
		}

		compare(dateTime: DataType_DateTime) {
			return this.value > dateTime.value
		}
	},
	String: class DataType_String extends DataTypeClass<string> {
		constructor(value: string) {
			super(value)
		}

		compare(string: DataType_String) {
			return this.value > string.value
		}
	},
	JSON: class DataType_JSON extends DataTypeClass<Object> {
		constructor(value: Object) {
			super(value)
		}

		compare(_json: Object) {
			throw new Error(`Cannot compare JSON.`)
			return true // Unreachable
		}
	}
}