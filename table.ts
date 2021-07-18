import { dataTypes } from './datatypes'
import { DB_Table, DB_Table_Col, DB_Table_Row_Formatted, RowFilterFunction } from './types'

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

	where(filterFunction: RowFilterFunction, maximumRowsToFind = Infinity) {
		const newRows: DB_Table_Row_Formatted[] = []
		let rowsFound = 0

		for (let i = 0; i < this.rows.length; i++) {
			const row = this.rows[i]
			row.rowNum = i

			if (filterFunction(row)) {
				newRows.push(row)
				rowsFound++

				if (rowsFound == maximumRowsToFind) {
					break
				}
			}
		}

		return Table.fromRows(newRows, this.cols)
	}

	between(index1: number, index2: number) {
		const newRows = this.rows.slice(index1, index2 + 1)

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