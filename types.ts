export interface DB {
	tables: {
		[tableName: string]: DB_Table
	},
	data?: any
}

export interface DB_Table {
	cols: DB_Table_Col[]
	rows: DB_Table_Row[]
	data?: any
}

export interface DB_Table_Col {
	name: string
	dataType: DataType
	constraints?: Constraint[]
	foreignKey?: Link
	linkedWith?: Link[]
	default?: any
	data?: {
		[key: string]: any
	}
}

export interface Link {
	table: string
	column: string
}

export type DB_Table_Row = any[]

export interface DB_Table_Row_Formatted {
	[colName: string]: any
}

export type DataType = 'Binary' | 'Hex' | 'Bit' | 'Int' | 'Float' | 'DateTime' | 'String' | 'Char' | 'JSON' | 'Boolean'
export type Constraint = 'primaryKey' | 'autoIncrement' | 'notNull' | 'unique'

export type RowFilterFunction = (row: DB_Table_Row_Formatted) => boolean