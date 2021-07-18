import * as fs from 'fs'
import * as chalk from 'chalk'
import { DB, DB_Table_Col, DB_Table_Row, DB_Table_Row_Formatted, Link, RowFilterFunction } from "./types"
import { Table } from './table'
import { DataTypeClass, dataTypes } from './datatypes'

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

		set data(value: any) {
			file.data = value

			writeDBFile()
		},

		get data() {
			return file.data
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

										if (!(el > prevNumber && el < nextNumber)) {
											if (options.safeAndFriendlyErrors) {
												throw new Error(`The value "${ el }" could not be inserted into column "${ col.name }" of this table, because this column has the 'autoIncrement' constraint. Just leave "${ col.name }" empty or insert a value bigger than ${ prevNumber } and smaller than ${ nextNumber }.`)
											}

											throw new Error(`Could not insert ${ chalk.red(el) } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } ${ (rowNum != undefined) ? `at row at index ${ rowNum } ` : '' }of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('autoIncrement') } constraint. Leave this column empty or insert a value bigger than ${ prevNumber } and smaller than ${ nextNumber }.`)
										}

										dataTypeParsedEl = new dataTypes.Int(el)
									}

									// notNull

									if (col.constraints.includes('notNull')) {
										// Todo: Should a notNull column be able to have a default value?

										if (el == undefined) {
											if (options.safeAndFriendlyErrors) {
												throw new Error(`Could not insert an empty value into the column "${ col.name }" of this table, since this column has the 'notNull' constraint. Fill in this column`)
											}

											throw new Error(`Could not insert ${ chalk.red('null') } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('notNull') } constraint. Fill in this column.`)
										}
									}

									// unique

									if (col.constraints.includes('unique')) {
										// Todo: use memory tricks to make checking for unique faster

										const { rows } = thisTable.get()
 
										for (let i = 0; i < rows.length; i++) {
											const row = rows[i]

											if (el == row[col.name] && rowNum != i) {
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
												throw new Error(`Could not insert an empty value into the column "${ col.name }" of this table, since this column has the 'primaryKey' constraint. Fill in this column`)
											}

											throw new Error(`Could not insert ${ chalk.red('null') } into column ${ chalk.yellow(col.name) } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) }, because this column has the ${ chalk.grey('primaryKey') } constraint. Fill in this column.`)
										}

										// Check for unique

										// primaryKey + autoIncrement should not interfere with each other

										if (!col.constraints.includes('autoIncrement')) {
											const { rows } = thisTable.get()

											for (let i = 0; i < rows.length; i++) {
												const row = rows[i]

												if (el == row[col.name] && rowNum != i) {
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
											throw new Error(`Could not insert the value "${ el }" into the column "${ col.name }" of this table, since this column linked with the (foreign) column "${ col.foreignKey.column }" of the table "${ col.foreignKey.table }". This means that the value you put in "${ el }" should also exist in the other column. This is not the case.\n\nIn order to insert this value here, first insert a row with the value "${ el }" into the (foreign) column "${ col.foreignKey.column }" of the table "${ col.foreignKey.column }".`)
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

				deleteWhere(filterFunction: RowFilterFunction) {
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

							rowTryingToDelete.rowNum = i + deleted

							if (filterFunction(rowTryingToDelete)) {
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
				},

				deleteAt(rowIndex: number) {
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

					try {
						const rowTryingToDelete = thisTable.get().rows[rowIndex]

						if (rowTryingToDelete == undefined) {
							if (options.safeAndFriendlyErrors) {
								throw new Error(`You tried to delete a non-existing row. Row number ${ rowIndex } does not exist in this table.`)
							}

							throw new Error(`Row at index ${ rowIndex } of table ${ chalk.magenta(tableName) } of database ${ chalk.cyan(filePath) } does not exist.`)
						}

						// Delete the row

						for (const entry of linkedColumns.entries()) {
							const linkedColName = entry[0]
							const linkedCols = entry[1]

							for (let linkedCol of linkedCols) {
								// Check if the linked column does not depend on the value we are trying to delete

								const thisTableCol = thisTable.get().getCol(linkedColName)

								const linkedTable = thisDb.table(linkedCol.table)
								const search = linkedTable.get().where(
									row => row[linkedCol.column] == rowTryingToDelete[thisTableCol.name]
								)

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

						file.tables[tableName].rows.splice(rowIndex, 1)

						writeDBFile()
					} catch(err) {
						// Restore changes on error

						file.tables[tableName] = tableBackup
						writeDBFile()

						throw err
					}
				}
			}

			return thisTable
		}
	}

	return thisDb
}