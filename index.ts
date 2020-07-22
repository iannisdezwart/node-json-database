import * as fs from 'fs'
import * as chalk from 'chalk'

export interface DB {
	tables: {
		[tableName: string]: DB_Table
	}
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

export class Table {
	cols: DB_Table_Col[]
	rows: DB_Table_Row_Formatted[]

	constructor(table?: DB_Table) {
		this.cols = table.cols

		this.rows = new Array(table.rows.length)

		for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
			let newRow = {}

			for (let colIndex = 0; colIndex < table.cols.length; colIndex++) {
				newRow[table.cols[colIndex].name] = table.rows[rowIndex][colIndex]
			}

			this.rows[rowIndex] = newRow
		}
	}

	select(colNames: string[]) {
		const newRows: DB_Table_Row_Formatted[] = []

		for (let rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
			let newRow: DB_Table_Row_Formatted = {}

			for (let colName of colNames) {
				newRow[colName] = this.rows[rowIndex][colName]
			}

			newRows[rowIndex] = newRow
		}

		return Table.fromRows(newRows, this.cols)
	}

	where(filterFunction: RowFilterFunction) {
		const newRows: DB_Table_Row_Formatted[] = []

		for (let i = 0; i < this.rows.length; i++) {
			const row = this.rows[i]
			row.rowNum = i

			if (filterFunction(row)) {
				newRows.push(row)
			}
		}

		return Table.fromRows(newRows, this.cols)
	}

	between(...indices: [ number, number ]) {
		const newRows = this.rows.slice(indices[0], indices[1] + 1)

		return Table.fromRows(newRows, this.cols)
	}

	top(numberOfRecords: number) {
		return this.between(0, numberOfRecords - 1)
	}

	bottom(numberOfRecords: number) {
		return this.between(this.rows.length - numberOfRecords, this.rows.length)
	}

	orderBy(colArr: (string | [ string, 'ASC' | 'DESC' ])[]) {
		if (colArr.length == 0) {
			return this
		} else {
			// Sort

			let sortedTable: Table
			let colName: string

			if (Array.isArray(colArr[0])) {
				colName = colArr[0][0]
				sortedTable = this.sortBy(colName, colArr[0][1])
			} else {
				colName = colArr[0]
				sortedTable = this.sortBy(colName)
			}
	
			// Split
	
			let prevValue = sortedTable.rows[0][colName]
			let currentSegment: DB_Table_Row_Formatted[] = []
			let outputTableRows: DB_Table_Row_Formatted[] = []
	
			const orderInner = (segment: DB_Table_Row_Formatted[], colNames: (string | [ string, 'ASC' | 'DESC' ])[]) =>
				Table.fromRows(segment, this.cols).orderBy(colNames).rows

			for (let i = 0; i < sortedTable.rows.length; i++) {
				// Split segment if consecutive records do not match

				if (sortedTable.rows[i][colName] != prevValue) {
					prevValue = sortedTable.rows[i][colName]

					// Order old segment and store it inside outputTableRows, recursively
	
					outputTableRows.push(...orderInner(currentSegment, colArr.slice(1)))

					// Open new segment
	
					currentSegment = []
				}
	
				currentSegment.push(sortedTable.rows[i])
			}
	
			// Order last segment
	
			outputTableRows.push(...orderInner(currentSegment, colArr.slice(1)))

			return Table.fromRows(outputTableRows, this.cols)
		}
	}

	sortBy(colName: string, direction: 'ASC' | 'DESC' = 'ASC') {

		let newRows = this.rows.concat()

		if (direction == 'ASC') {
			newRows.sort((a, b) => {
				const dataType = this.getCol(colName).dataType

				const value1 = new dataTypes[dataType](a[colName])
				const value2 = new dataTypes[dataType](b[colName])

				return value1.compare(value2) ? 1 : -1
			})
		} else {
			newRows.sort((a, b) => {
				const { dataType } = this.getCol(colName)

				const value1 = new dataTypes[dataType](a[colName])
				const value2 = new dataTypes[dataType](b[colName])

				return value1.compare(value2) ? -1 : 1
			})
		}

		return Table.fromRows(newRows, this.cols)
	}

	groupBy(colName: string) {
		const segments: Table[] = []
		const sortedTable = this.sortBy(colName)

		// Split
	
		let prevValue = sortedTable.rows[0][colName]
		let currentSegment: DB_Table_Row_Formatted[] = []

		for (let i = 0; i < sortedTable.rows.length; i++) {
			// Split segment if consecutive records do not match

			if (sortedTable.rows[i][colName] != prevValue) {
				prevValue = sortedTable.rows[i][colName]

				// Put current segment in segments
				
				segments.push(Table.fromRows(currentSegment, this.cols))

				// Open new segment

				currentSegment = []
			}

			currentSegment.push(sortedTable.rows[i])
		}

		// Put last segment in segments

			segments.push(Table.fromRows(currentSegment, this.cols))

		return segments
	}

	max(colName: string) {
		const { dataType } = this.getCol(colName)

		let max = new dataTypes[dataType](this.rows[0][colName])
		let maxIndex = 0

		for (let i = 1; i < this.rows.length; i++) {
			const currentRecord = new dataTypes[dataType](this.rows[i][colName])

			if (currentRecord.compare(max)) {
				max = currentRecord
				maxIndex = i
			}
		}

		return this.rows[maxIndex][colName]
	}

	min(colName: string) {
		const { dataType } = this.getCol(colName)

		let min = new dataTypes[dataType](this.rows[0][colName])
		let minIndex = 0

		for (let i = 1; i < this.rows.length; i++) {
			const currentRecord = new dataTypes[dataType](this.rows[i][colName])

			if (!currentRecord.compare(min)) {
				min = currentRecord
				minIndex = i
			}
		}

		return this.rows[minIndex][colName]
	}

	sum(colName: string) {
		const { dataType } = this.getCol(colName)

		if (typeof new dataTypes[dataType](this.rows[0][colName]).value != 'number') {
			throw new Error(`Cannot sum up dataType "${ dataType }"`)
		}

		let sum = 0

		for (let i = 0; i < this.rows.length; i++) {
			sum += this.rows[i][colName]
		}

		return sum
	}

	avg(colName: string) {
		return this.sum(colName) / this.rows.length
	}

	join(table2: Table) {
		const table1 = this

		// Search for double columns

		const colsOfTable2 = new Set(table2.cols.map(col => col.name))
		const doubleColums: string[] = []
		const newCols: DB_Table_Col[] = []

		for (let i = 0; i < table1.cols.length; i++) {
			const colName = table1.cols[i].name

			if (colsOfTable2.has(colName)) {
				doubleColums.push(colName)
			} else {
				// Push left side of union to the newCols

				newCols.push(table1.cols[i])
			}
		}

		// Push right and middle side of union to newCols

		for (let i = 0; i < table2.cols.length; i++) {
			newCols.push(table2.cols[i])
		}

		// Generate the newRows

		const newRows: DB_Table_Row_Formatted[] = []

		for (let i = 0; i < table1.rows.length; i++) {
			const newRow: DB_Table_Row_Formatted = table1.rows[i]

			let joinRow = table2.where(row => {
				for (let doubleColumn of doubleColums) {
					if (row[doubleColumn] != table1.rows[i][doubleColumn]) {
						return false
					}
				}

				return true
			}).rows[0] // Assuming that there is only one joinRow

			if (joinRow == undefined) {
				joinRow = {}
			}

			// Set all right side columns
			
			for (let col of colsOfTable2) {
				if (!(doubleColums.includes(col))) {
					// Fill coulumns with null if they could not be joined

					const insertValue = (joinRow[col] != undefined) ? joinRow[col] : null
					newRow[col] = insertValue
				}
			}

			newRows.push(newRow)
		}

		return Table.fromRows(newRows, newCols)
	}

	getCol(colName: string) {
		for (let col of this.cols) {
			if (colName == col.name) {
				return col
			}
		}
	}

	static fromRows(rows: DB_Table_Row_Formatted[], cols: DB_Table_Col[]) {
		const table = new Table({ cols, rows: [] })

		table.rows = rows

		return table
	}

	get length() {
		return this.rows.length
	}
}

abstract class DataTypeClass<T> {
	public value: T

	constructor(value: T) {
		this.value = value
	}

	abstract compare(other: DataTypeClass<T>): boolean
}

interface DataTypeClassConstructor<T> {
	new (value: T): DataTypeClass<T>
}

const dataTypes: {
	[ keys: string ]: DataTypeClassConstructor<any>
} = {
	Int: class DataType_Int extends DataTypeClass<number> {
		constructor(value: number) {
			super(~~value)
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

interface DB_Function_Options {
	safeAndFriendlyErrors?: boolean
}

export const db = (filePath: string, options: DB_Function_Options = {}) => {
	options = {
		...{
			safeAndFriendlyErrors: false
		},
		...options
	}
	
	let file: DB = fs.existsSync(filePath)
		? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
		: null
	
	const writeDBFile = () => {
		fs.writeFileSync(filePath, JSON.stringify(file, null, 2))
	}

	// Returns thisDb
	
	const thisDb = {
		create() {
			if (file != null) {
				if (options.safeAndFriendlyErrors) {
					throw new Error(`This database already exists.`)
				}

				throw new Error(`Database ${ chalk.cyan(filePath) } already exists.`)
			}

			file = {
				tables: {}
			}

			writeDBFile()
		},

		drop() {
			if (file == null) {
				if (options.safeAndFriendlyErrors) {
					throw new Error(`This database does not exist.`)
				}

				throw new Error(`Database ${ chalk.cyan(filePath) } does not exist.`)
			}

			file = null

			fs.unlinkSync(filePath)
		},

		copy(newFilePath: string) {
			if (fs.existsSync(newFilePath)) {
				if (options.safeAndFriendlyErrors) {
					throw new Error(`That database already exists. Cannot copy to an existing database.`)
				}

				throw new Error(`Database ${ chalk.cyan(newFilePath) } already exists. Cannot copy to an existing database.`)
			}

			fs.writeFileSync(newFilePath, JSON.stringify(file, null, 2))
		},

		get exists() {
			return file != null
		},

		getTables() {
			const tableNames: string[] = []

			for (let tableName in file.tables) {
				tableNames.push(tableName)
			}

			return tableNames
		},

		table(tableName: string) {
			if (file == null) {
				if (options.safeAndFriendlyErrors) {
					throw new Error(`This database doesn not exist.`)
				}

				throw new Error(`Database ${ chalk.cyan(filePath) } does not exist.`)
			}

			// Returns thisTable

			const thisTable = {
				get exists() {
					return file.tables[tableName] != undefined
				},

				create() {
					if (thisTable.exists) {
						if (options.safeAndFriendlyErrors) {
							throw new Error(`The table "${ tableName }" already exists in this database`)
						}

						throw new Error(`Table ${ chalk.magenta(tableName) } already exists in database ${ chalk.cyan(filePath) }.`)
					}

					if (file.tables == undefined) {
						file.tables = {}
					}

					file.tables[tableName] = { cols: [], rows: [] }

					writeDBFile()
				},
				
				drop() {
					if (!thisTable.exists) {
						if (options.safeAndFriendlyErrors) {
							throw new Error(`The table "${ tableName }" does not exist in this database`)
						}

						throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
					}

					
					const table = new Table(file.tables[tableName])
					
					const colNames = []
					for (let col of table.cols) {
						colNames.push(col.name)
					}

					// Try to delete all columns

					thisTable.columns.drop(colNames)

					delete file.tables[tableName]

					writeDBFile()
				},

				get() {
					if (!thisTable.exists) {
						if (options.safeAndFriendlyErrors) {
							throw new Error(`The table "${ tableName }" does not exist in this database`)
						}

						throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
					}

					return new Table(file.tables[tableName])
				},

				get rowCount() {
					return file.tables[tableName].rows.length
				},

				get colCount() {
					return file.tables[tableName].cols.length
				},

				set data(value: any) {
					file.tables[tableName].data = value

					writeDBFile()
				},

				get data() {
					return file.tables[tableName].data
				},

				columns: {
					add(cols: DB_Table_Col[]) {
						if (!thisTable.exists) {
							if (options.safeAndFriendlyErrors) {
								throw new Error(`The table "${ tableName }" does not exist in this database`)
							}

							throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
						}

						// Create map of existing table columns

						const table = thisTable.get()
						const tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]))
						const existingCols = new Map<string, DB_Table_Col>()

						for (let col of table.cols) {
							existingCols.set(col.name, col)
						}

						try {
							// Check if each column is valid

							for (let col of cols) {
								if (col.name == undefined || col.dataType == undefined) {
									if (options.safeAndFriendlyErrors) {
										throw new Error(`A column should have at least the 'name' and 'dataType' properties. You specified this:\n${ JSON.stringify(col, null, 2) }`)
									}

									throw new Error(`A column should have at least the 'name' and 'dataType' properties. Got: ${ chalk.red(JSON.stringify(col, null, 2)) }.`)
								}

								if (existingCols.has(col.name)) {
									if (options.safeAndFriendlyErrors) {
										throw new Error(`The column "${ col.name }" already exists in this table.`)
									}

									throw new Error(`Column ${ chalk.yellow(col.name) } already exists in table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }.`)
								}
							}

							// Add each column

							for (let col of cols) {
								// Handle primaryKey and foreignKey
								
								const { foreignKey } = col
								
								if (foreignKey != undefined) {
									const foreignCol = thisDb.table(foreignKey.table).get().getCol(foreignKey.column)
									
									if (foreignCol.constraints == undefined) {
										if (options.safeAndFriendlyErrors) {
											throw new Error(`The column "${ col.name }" could not be added to this table because you specified that the values should be linked with the (foreign) column "${ foreignKey.column }" of the table "${ foreignKey.table }". The latter column does not have the 'primaryKey' constraint, which is required to do this.`)
										}

										throw new Error(`Could not add column ${ chalk.yellow(col.name) } to table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because its foreignKey links to a non-primaryKey column. column ${ foreignKey.column } of table ${ foreignKey.table } must have the primaryKey constraint.`)
									}

									if (!foreignCol.constraints.includes('primaryKey')) {
										if (options.safeAndFriendlyErrors) {
											throw new Error(`The column "${ col.name }" could not be added to this table because you specified that the values should be linked with the (foreign) column "${ foreignKey.column }" of the table "${ foreignKey.table }". The latter column does not have the 'primaryKey' constraint, which is required to do this.`)
										}

										throw new Error(`Could not add column ${ chalk.yellow(col.name) } to table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because its foreignKey links to a non-primaryKey column. column ${ foreignKey.column } of table ${ foreignKey.table } must have the primaryKey constraint.`)
									}

									if (foreignCol.linkedWith == undefined) {
										foreignCol.linkedWith = []
									}

									foreignCol.linkedWith.push({ table: tableName, column: col.name })
								}

								table.cols.push(col)
							}

							writeDBFile()
						} catch(err) {
							// Restore changes on error

							file.tables[tableName] = tableBackup
							writeDBFile()

							throw err
						}
						
					},

					drop(colNames: string[]) {
						if (!thisTable.exists) {
							if (options.safeAndFriendlyErrors) {
								throw new Error(`The table "${ tableName }" does not exist in this database`)
							}

							throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
						}

						const table = thisTable.get()
						const tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]))

						try {
							for (let colName of colNames) {
								const col = table.getCol(colName)
	
								if (col == undefined) {
									if (options.safeAndFriendlyErrors) {
										throw new Error(`You cannot drop the column "${ colName }", since it does not exist in this table.`)
									}

									throw new Error(`Column ${ chalk.yellow(colName) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) } does not exist.`)
								}
	
								// Check linkedWith relations
	
								const { linkedWith, foreignKey } = col
	
								if (linkedWith != undefined) {
									if (linkedWith.length > 0) {
										if (options.safeAndFriendlyErrors) {
											throw new Error(`You cannot drop the column "${ colName }", since it is linked to these columns:\n${ linkedWith.map(link => `Column "${ link.column }" of Table "${ link.table }"`).join(', and ') }.\nIn order to drop this column, you must drop the columns it is linked to first.`)
										}

										throw new Error(`Could not drop column ${ chalk.yellow(colName) } because it is a primaryKey linked to these columns:\n${ chalk.cyan(JSON.stringify(linkedWith, null, 2)) }\nIn order to drop this column, you must drop the columns it is linked to first.`)
									}
								}
	
								// Unlink foreignKey relation, if necessary
	
								if (foreignKey != undefined) {
									const foreignCol = thisDb.table(foreignKey.table).get().getCol(foreignKey.column)
	
									for (let i = 0; i < foreignCol.linkedWith.length; i++) {
										const linkedCol = foreignCol.linkedWith[i]
	
										if (linkedCol.table == tableName && linkedCol.column == colName) {
											foreignCol.linkedWith.splice(i, 1)
										}
									}
								}
	
								// Delete column from table.cols
	
								for (let i = 0; i < file.tables[tableName].cols.length; i++) {
									const colOfTable = file.tables[tableName].cols[i]
									
									if (colOfTable.name == colName) {
										table.cols.splice(i, 1)
									}
								}
							}
	
							writeDBFile()
						} catch(err) {
							// Restore changes on error

							file.tables[tableName] = tableBackup
							writeDBFile()

							throw err
						}
					}

				},

				insert(rows: DB_Table_Row_Formatted[], rowNum?: number) {
					if (!thisTable.exists) {
						if (options.safeAndFriendlyErrors) {
							throw new Error(`The table "${ tableName }" does not exist in this database.`)
						}

						throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
					}

					const table = thisTable.get()
					const tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]))

					try {
						for (let row of rows) {
							const newRow: DB_Table_Row = []
							
							for (let col of table.cols) {
								let el = row[col.name]
								let dataTypeParsedEl: DataTypeClass<any>
								
								// Set to default if undefined
								
								if (el == undefined && col.default != undefined) {
									el = col.default
								}
								
								// Check for dataType
								
								try {
									dataTypeParsedEl = new dataTypes[col.dataType](el)
								} catch(err) {
									if (options.safeAndFriendlyErrors) {
										throw new Error(`The value "${ el }" could not be inserted into column "${ col.name }" of this table, because it could not be converted to dataType "${ col.dataType }"`)
									}

									throw new Error(`Could not insert value ${ chalk.red(el) } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, beacuse it could not be converted to dataType ${ chalk.green(col.dataType) }.`)
								}
								
								// Check constraints

								if (col.constraints != undefined) {
									// autoIncrement

									if (col.constraints.includes('autoIncrement')) {
										const table = thisTable.get()

										const prevNumber = (rowNum == undefined)
											? (table.rows.length > 0)
												? table.rows[table.rows.length - 1][col.name]
												: 0
											: (rowNum > 0)
												? table.rows[rowNum - 1][col.name]
												: 0

										if (el == null) {
											el = prevNumber + 1
										}

										const nextNumber = (rowNum == undefined)
											? Infinity
											: (rowNum < table.rows.length - 1)
												? table.rows[rowNum + 1][col.name]
												: Infinity

										if (el < prevNumber && el > nextNumber) {
											if (options.safeAndFriendlyErrors) {
												throw new Error(`The value "${ el }" could not be inserted into column "${ col.name }" of this table, because this column has the 'autoIncrement' constraint. Just leave this field empty or insert a value bigger than ${ prevNumber } and smaller than ${ nextNumber }.`)
											}

											throw new Error(`Could not insert ${ chalk.red(el) } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } ${ (rowNum != undefined) ? `at row at index ${ rowNum }` : '' } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('autoIncrement') } constraint. Leave this column empty or insert a value bigger than ${ prevNumber } and smaller than ${ nextNumber }.`)
										}

										dataTypeParsedEl = new dataTypes.Int(el)
									}

									// notNull
									
									if (col.constraints.includes('notNull')) {
										// Todo: Should a notNull column be able to have a default value?

										if (el == undefined) {
											if (options.safeAndFriendlyErrors) {
												throw new Error(`Could not insert en empty value into the column "${ col.name }" of this table, since this column has the 'autoIncrement' constraint. Fill in this column`)
											}

											throw new Error(`Could not insert ${ chalk.red('null') } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('autoIncrement') } constraint. Fill in this column.`)
										}
									}

									// unique

									if (col.constraints.includes('unique')) {
										// Todo: use memory tricks to make cheking for unique faster

										for (let row of thisTable.get().rows) {
											if (el == row[col.name]) {
												if (options.safeAndFriendlyErrors) {
													throw new Error(`The value "${ el }" could not be inserted into column "${ col.name }" of this table, because this column has the 'unique' constraint. This means that you cannot insert duplicate values. The value "${ el }" has already been entered in this row:\n${ JSON.stringify(row, null, 2) }.`)
												}

												throw new Error(`Could not insert ${ chalk.red(el) } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('unique') } constraint. The value has already been entered in this row:\n${ chalk.red(JSON.stringify(row, null, 2)) }.`)
											}
										}
									}

									// primaryKey

									if (col.constraints.includes('primaryKey')) {
										// Check for notNull

										if (el == undefined) {
											if (options.safeAndFriendlyErrors) {
												throw new Error(`Could not insert en empty value into the column "${ col.name }" of this table, since this column has the 'primaryKey' constraint. Fill in this column`)
											}

											throw new Error(`Could not insert ${ chalk.red('null') } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('primaryKey') } constraint. Fill in this column.`)
										}

										// Check for unique

										// primaryKey + autoIncrement should not interfere with each other

										if (!col.constraints.includes('autoIncrement')) {
											for (let row of thisTable.get().rows) {
	
												if (el == row[col.name]) {
													if (options.safeAndFriendlyErrors) {
														throw new Error(`Could not insert the value "${ el }" into the column "${ col.name }" of this table, since this column has the 'primaryKey' constraint. This means that you cannot insert duplicate values. The value "${ el }" has already been entered in this row:\n${ JSON.stringify(row, null, 2) }.`)
													}

													throw new Error(`Could not insert ${ chalk.red(el) } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('primaryKey') } constraint. The value has already been entered in this row:\n${ chalk.red(JSON.stringify(row, null, 2)) }.`)
												}
											}
										}
									}
								}

								// Check foreignKey relations

								if (col.foreignKey != undefined) {
									// Check if value exists in foreign table

									const foreignValue = thisDb
										.table(col.foreignKey.table)
										.get()
										.where(row => row[col.name] == el)

									if (foreignValue == undefined) {
										if (options.safeAndFriendlyErrors) {
											throw new Error(`Could not insert the value "${ el }" into the column "${ col.name }" of this table, since this column linked with the (foreign) column "${ col.foreignKey.column }" of the table "${ col.foreignKey.table }". This means that the value you put in this field should also exist in the latter column. This is not the case.\n\nIn order to insert this value here, first insert a row with the value "${ el }" into the (foreign) column "${ col.foreignKey.column }" of the table "${ col.foreignKey.column }".`)
										}

										throw new Error(`Could not insert ${ chalk.red(el) } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has a foreignKey to table '${ col.foreignKey.table }', column '${ col.foreignKey.column }'. This value was not found in the foreign column.`)
									}
								}

								newRow.push(dataTypeParsedEl.value)
							}

							if (rowNum != undefined) {
								// Overwrite

								file.tables[tableName].rows[rowNum] = newRow
							} else {
								// Append

								file.tables[tableName].rows.push(newRow)
							}

						}
	
						writeDBFile()
					} catch(err) {
						// Restore changes on error

						file.tables[tableName] = tableBackup
						writeDBFile()

						throw err
					}

				},

				update(newRow: DB_Table_Row_Formatted, where: RowFilterFunction) {
					if (!thisTable.exists) {
						if (options.safeAndFriendlyErrors) {
							throw new Error(`The table "${ tableName }" does not exist in this database`)
						}

						throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
					}

					const table = thisTable.get()
					const tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]))
					let updated = 0

					try {
						for (let i = 0; i < table.rows.length; i++) {
							const row = table.rows[i]
							row.rowNum = i

							if (where(row)) {
								// Update this row

								const insertRow = { ...row, ...newRow }
								thisTable.insert([ insertRow ], i)

								updated++
							}
						}

						// We do not have to call writeDBFile, since table.insert does this
					} catch(err) {
						// Restore changes on error

						file.tables[tableName] = tableBackup
						writeDBFile()

						throw err
					}

					return updated
				},

				delete(where: RowFilterFunction) {
					if (!thisTable.exists) {
						if (options.safeAndFriendlyErrors) {
							throw new Error(`The table "${ tableName }" does not exist in this database`)
						}

						throw new Error(`Table ${ chalk.magenta(tableName) } does not exist in database ${ chalk.cyan(filePath) }.`)
					}

					const table = thisTable.get()

					// Get map of linked columns

					const linkedColumns = new Map<string, Link[]>()

					for (let col of table.cols) {
						if (col.linkedWith != undefined) {
							linkedColumns.set(col.name, col.linkedWith)
						}
					}

					const tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]))
					let deleted = 0

					try {
						let i = 0

						while (true) {
							const rowTryingToDelete = thisTable.get().rows[i]
							if (rowTryingToDelete == undefined) {
								// We reached the end of the table

								break
							}

							rowTryingToDelete.rowNum = i

							if (where(rowTryingToDelete)) {
								// Delete this row
								
								for (const entry of linkedColumns.entries()) {
									const linkedColName = entry[0]
									const linkedCols = entry[1]
									
									for (let linkedCol of linkedCols) {
										// Check if the linked column does not depend on the value we are trying to delete

										const thisTableCol = thisTable.get().getCol(linkedColName)

										const linkedTable = thisDb.table(linkedCol.table)
										const search = linkedTable.get().where(row => row[linkedCol.column] == rowTryingToDelete[thisTableCol.name])

										const foundValues = JSON.stringify(search.rows, null, 2)

										// Throw error if the value exists

										if (search.rows.length > 0) {
											if (options.safeAndFriendlyErrors) {
												throw new Error(`Could not delete the following row:\n${ JSON.stringify(rowTryingToDelete, null, 2) }\n from this table, since the column "${ linkedColName }" (which holds the value "${ rowTryingToDelete[linkedColName] }") is linked to the (foreign) column "${ linkedCol.column }" of the table "${ linkedCol.table }". The latter column is dependent on this value.\n\nIn order to delte the value "${ rowTryingToDelete[linkedColName] }" from the column "${ linkedColName }" in this table, first delete these rows from the table "${ linkedCol.table }":\n${ foundValues }.`)
											}

											throw new Error(`Could not delete row\n${ chalk.red(JSON.stringify(rowTryingToDelete, null, 2)) }\nfrom column ${ chalk.yellow(linkedColName) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column is linked to a foreignKey from column ${ chalk.yellow(linkedCol.column) }, from table ${ chalk.magenta(linkedCol.table) }. The following dependent records were found in the linked column. First remove those records:\n${ chalk.red(foundValues) }.`)
										}
									}
								}

								file.tables[tableName].rows.splice(i, 1)

								deleted++
							} else {
								i++
							}
						}

						writeDBFile()
					} catch(err) {
						// Restore changes on error

						file.tables[tableName] = tableBackup
						writeDBFile()

						throw err
					}

					return deleted
				}
			}

			return thisTable
		}
	}

	return thisDb
}