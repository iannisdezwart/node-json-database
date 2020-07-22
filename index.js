"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Table = void 0;
var fs = require("fs");
var chalk = require("chalk");
var Table = /** @class */ (function () {
    function Table(table) {
        this.cols = table.cols;
        this.rows = new Array(table.rows.length);
        for (var rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
            var newRow = {};
            for (var colIndex = 0; colIndex < table.cols.length; colIndex++) {
                newRow[table.cols[colIndex].name] = table.rows[rowIndex][colIndex];
            }
            this.rows[rowIndex] = newRow;
        }
    }
    Table.prototype.select = function (colNames) {
        var e_1, _a;
        var newRows = [];
        for (var rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
            var newRow = {};
            try {
                for (var colNames_1 = (e_1 = void 0, __values(colNames)), colNames_1_1 = colNames_1.next(); !colNames_1_1.done; colNames_1_1 = colNames_1.next()) {
                    var colName = colNames_1_1.value;
                    newRow[colName] = this.rows[rowIndex][colName];
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (colNames_1_1 && !colNames_1_1.done && (_a = colNames_1.return)) _a.call(colNames_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            newRows[rowIndex] = newRow;
        }
        return Table.fromRows(newRows, this.cols);
    };
    Table.prototype.where = function (filterFunction) {
        var newRows = [];
        for (var i = 0; i < this.rows.length; i++) {
            var row = this.rows[i];
            row.rowNum = i;
            if (filterFunction(row)) {
                newRows.push(row);
            }
        }
        return Table.fromRows(newRows, this.cols);
    };
    Table.prototype.between = function () {
        var indices = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            indices[_i] = arguments[_i];
        }
        var newRows = this.rows.slice(indices[0], indices[1] + 1);
        return Table.fromRows(newRows, this.cols);
    };
    Table.prototype.top = function (numberOfRecords) {
        return this.between(0, numberOfRecords - 1);
    };
    Table.prototype.bottom = function (numberOfRecords) {
        return this.between(this.rows.length - numberOfRecords, this.rows.length);
    };
    Table.prototype.orderBy = function (colArr) {
        var _this = this;
        if (colArr.length == 0) {
            return this;
        }
        else {
            // Sort
            var sortedTable = void 0;
            var colName = void 0;
            if (Array.isArray(colArr[0])) {
                colName = colArr[0][0];
                sortedTable = this.sortBy(colName, colArr[0][1]);
            }
            else {
                colName = colArr[0];
                sortedTable = this.sortBy(colName);
            }
            // Split
            var prevValue = sortedTable.rows[0][colName];
            var currentSegment = [];
            var outputTableRows = [];
            var orderInner = function (segment, colNames) {
                return Table.fromRows(segment, _this.cols).orderBy(colNames).rows;
            };
            for (var i = 0; i < sortedTable.rows.length; i++) {
                // Split segment if consecutive records do not match
                if (sortedTable.rows[i][colName] != prevValue) {
                    prevValue = sortedTable.rows[i][colName];
                    // Order old segment and store it inside outputTableRows, recursively
                    outputTableRows.push.apply(outputTableRows, __spread(orderInner(currentSegment, colArr.slice(1))));
                    // Open new segment
                    currentSegment = [];
                }
                currentSegment.push(sortedTable.rows[i]);
            }
            // Order last segment
            outputTableRows.push.apply(outputTableRows, __spread(orderInner(currentSegment, colArr.slice(1))));
            return Table.fromRows(outputTableRows, this.cols);
        }
    };
    Table.prototype.sortBy = function (colName, direction) {
        var _this = this;
        if (direction === void 0) { direction = 'ASC'; }
        var newRows = this.rows.concat();
        if (direction == 'ASC') {
            newRows.sort(function (a, b) {
                var dataType = _this.getCol(colName).dataType;
                var value1 = new dataTypes[dataType](a[colName]);
                var value2 = new dataTypes[dataType](b[colName]);
                return value1.compare(value2) ? 1 : -1;
            });
        }
        else {
            newRows.sort(function (a, b) {
                var dataType = _this.getCol(colName).dataType;
                var value1 = new dataTypes[dataType](a[colName]);
                var value2 = new dataTypes[dataType](b[colName]);
                return value1.compare(value2) ? -1 : 1;
            });
        }
        return Table.fromRows(newRows, this.cols);
    };
    Table.prototype.groupBy = function (colName) {
        var segments = [];
        var sortedTable = this.sortBy(colName);
        // Split
        var prevValue = sortedTable.rows[0][colName];
        var currentSegment = [];
        for (var i = 0; i < sortedTable.rows.length; i++) {
            // Split segment if consecutive records do not match
            if (sortedTable.rows[i][colName] != prevValue) {
                prevValue = sortedTable.rows[i][colName];
                // Put current segment in segments
                segments.push(Table.fromRows(currentSegment, this.cols));
                // Open new segment
                currentSegment = [];
            }
            currentSegment.push(sortedTable.rows[i]);
        }
        // Put last segment in segments
        segments.push(Table.fromRows(currentSegment, this.cols));
        return segments;
    };
    Table.prototype.max = function (colName) {
        var dataType = this.getCol(colName).dataType;
        var max = new dataTypes[dataType](this.rows[0][colName]);
        var maxIndex = 0;
        for (var i = 1; i < this.rows.length; i++) {
            var currentRecord = new dataTypes[dataType](this.rows[i][colName]);
            if (currentRecord.compare(max)) {
                max = currentRecord;
                maxIndex = i;
            }
        }
        return this.rows[maxIndex][colName];
    };
    Table.prototype.min = function (colName) {
        var dataType = this.getCol(colName).dataType;
        var min = new dataTypes[dataType](this.rows[0][colName]);
        var minIndex = 0;
        for (var i = 1; i < this.rows.length; i++) {
            var currentRecord = new dataTypes[dataType](this.rows[i][colName]);
            if (!currentRecord.compare(min)) {
                min = currentRecord;
                minIndex = i;
            }
        }
        return this.rows[minIndex][colName];
    };
    Table.prototype.sum = function (colName) {
        var dataType = this.getCol(colName).dataType;
        if (typeof new dataTypes[dataType](this.rows[0][colName]).value != 'number') {
            throw new Error("Cannot sum up dataType \"" + dataType + "\"");
        }
        var sum = 0;
        for (var i = 0; i < this.rows.length; i++) {
            sum += this.rows[i][colName];
        }
        return sum;
    };
    Table.prototype.avg = function (colName) {
        return this.sum(colName) / this.rows.length;
    };
    Table.prototype.join = function (table2) {
        var table1 = this;
        // Search for double columns
        var colsOfTable2 = new Set(table2.cols.map(function (col) { return col.name; }));
        var doubleColums = [];
        var newCols = [];
        for (var i = 0; i < table1.cols.length; i++) {
            var colName = table1.cols[i].name;
            if (colsOfTable2.has(colName)) {
                doubleColums.push(colName);
            }
            else {
                // Push left side of union to the newCols
                newCols.push(table1.cols[i]);
            }
        }
        // Push right and middle side of union to newCols
        for (var i = 0; i < table2.cols.length; i++) {
            newCols.push(table2.cols[i]);
        }
        // Generate the newRows
        var newRows = [];
        var _loop_1 = function (i) {
            var e_2, _a;
            var newRow = table1.rows[i];
            var joinRow = table2.where(function (row) {
                var e_3, _a;
                try {
                    for (var doubleColums_1 = (e_3 = void 0, __values(doubleColums)), doubleColums_1_1 = doubleColums_1.next(); !doubleColums_1_1.done; doubleColums_1_1 = doubleColums_1.next()) {
                        var doubleColumn = doubleColums_1_1.value;
                        if (row[doubleColumn] != table1.rows[i][doubleColumn]) {
                            return false;
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (doubleColums_1_1 && !doubleColums_1_1.done && (_a = doubleColums_1.return)) _a.call(doubleColums_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                return true;
            }).rows[0]; // Assuming that there is only one joinRow
            if (joinRow == undefined) {
                joinRow = {};
            }
            try {
                // Set all right side columns
                for (var colsOfTable2_1 = (e_2 = void 0, __values(colsOfTable2)), colsOfTable2_1_1 = colsOfTable2_1.next(); !colsOfTable2_1_1.done; colsOfTable2_1_1 = colsOfTable2_1.next()) {
                    var col = colsOfTable2_1_1.value;
                    if (!(doubleColums.includes(col))) {
                        // Fill coulumns with null if they could not be joined
                        var insertValue = (joinRow[col] != undefined) ? joinRow[col] : null;
                        newRow[col] = insertValue;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (colsOfTable2_1_1 && !colsOfTable2_1_1.done && (_a = colsOfTable2_1.return)) _a.call(colsOfTable2_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            newRows.push(newRow);
        };
        for (var i = 0; i < table1.rows.length; i++) {
            _loop_1(i);
        }
        return Table.fromRows(newRows, newCols);
    };
    Table.prototype.getCol = function (colName) {
        var e_4, _a;
        try {
            for (var _b = __values(this.cols), _c = _b.next(); !_c.done; _c = _b.next()) {
                var col = _c.value;
                if (colName == col.name) {
                    return col;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
    };
    Table.fromRows = function (rows, cols) {
        var table = new Table({ cols: cols, rows: [] });
        table.rows = rows;
        return table;
    };
    Object.defineProperty(Table.prototype, "length", {
        get: function () {
            return this.rows.length;
        },
        enumerable: false,
        configurable: true
    });
    return Table;
}());
exports.Table = Table;
var DataTypeClass = /** @class */ (function () {
    function DataTypeClass(value) {
        this.value = value;
    }
    return DataTypeClass;
}());
var dataTypes = {
    Int: /** @class */ (function (_super) {
        __extends(DataType_Int, _super);
        function DataType_Int(value) {
            return _super.call(this, ~~value) || this;
        }
        DataType_Int.prototype.compare = function (int) {
            return this.value > int.value;
        };
        return DataType_Int;
    }(DataTypeClass)),
    Float: /** @class */ (function (_super) {
        __extends(DataType_Float, _super);
        function DataType_Float(value) {
            return _super.call(this, value) || this;
        }
        DataType_Float.prototype.compare = function (float) {
            return this.value > float.value;
        };
        return DataType_Float;
    }(DataTypeClass)),
    Binary: /** @class */ (function (_super) {
        __extends(DataType_Binary, _super);
        function DataType_Binary(value) {
            var _this = this;
            if (value.replace('0', '').replace('1', '') == '') {
                throw new Error("Cannot convert \"" + value + "\" to binary. Expected only 0's and 1's");
            }
            _this = _super.call(this, parseInt(value, 2)) || this;
            return _this;
        }
        DataType_Binary.prototype.compare = function (binary) {
            return this.value > binary.value;
        };
        return DataType_Binary;
    }(DataTypeClass)),
    Boolean: /** @class */ (function (_super) {
        __extends(DataType_Boolean, _super);
        function DataType_Boolean(value) {
            return _super.call(this, value) || this;
        }
        DataType_Boolean.prototype.compare = function (boolean) {
            return this.value > boolean.value;
        };
        return DataType_Boolean;
    }(DataTypeClass)),
    DateTime: /** @class */ (function (_super) {
        __extends(DataType_DateTime, _super);
        function DataType_DateTime(value) {
            return _super.call(this, value) || this;
        }
        DataType_DateTime.prototype.compare = function (dateTime) {
            return this.value > dateTime.value;
        };
        return DataType_DateTime;
    }(DataTypeClass)),
    String: /** @class */ (function (_super) {
        __extends(DataType_String, _super);
        function DataType_String(value) {
            return _super.call(this, value) || this;
        }
        DataType_String.prototype.compare = function (string) {
            return this.value > string.value;
        };
        return DataType_String;
    }(DataTypeClass)),
    JSON: /** @class */ (function (_super) {
        __extends(DataType_JSON, _super);
        function DataType_JSON(value) {
            return _super.call(this, value) || this;
        }
        DataType_JSON.prototype.compare = function (_json) {
            throw new Error("Cannot compare JSON.");
            return true; // Unreachable
        };
        return DataType_JSON;
    }(DataTypeClass))
};
exports.db = function (filePath, options) {
    if (options === void 0) { options = {}; }
    options = __assign(__assign({}, options), {
        safeAndFriendlyErrors: false
    });
    var file = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        : null;
    var writeDBFile = function () {
        fs.writeFileSync(filePath, JSON.stringify(file, null, 2));
    };
    // Returns thisDb
    var thisDb = {
        create: function () {
            if (file != null) {
                if (options.safeAndFriendlyErrors) {
                    throw new Error("This database already exists.");
                }
                throw new Error("Database " + chalk.cyan(filePath) + " already exists.");
            }
            file = {
                tables: {}
            };
            writeDBFile();
        },
        drop: function () {
            if (file == null) {
                if (options.safeAndFriendlyErrors) {
                    throw new Error("This database does not exist.");
                }
                throw new Error("Database " + chalk.cyan(filePath) + " does not exist.");
            }
            file = null;
            fs.unlinkSync(filePath);
        },
        copy: function (newFilePath) {
            if (fs.existsSync(newFilePath)) {
                if (options.safeAndFriendlyErrors) {
                    throw new Error("That database already exists. Cannot copy to an existing database.");
                }
                throw new Error("Database " + chalk.cyan(newFilePath) + " already exists. Cannot copy to an existing database.");
            }
            fs.writeFileSync(newFilePath, JSON.stringify(file, null, 2));
        },
        get exists() {
            return file != null;
        },
        getTables: function () {
            var tableNames = [];
            for (var tableName in file.tables) {
                tableNames.push(tableName);
            }
            return tableNames;
        },
        table: function (tableName) {
            if (file == null) {
                if (options.safeAndFriendlyErrors) {
                    throw new Error("This database doesn not exist.");
                }
                throw new Error("Database " + chalk.cyan(filePath) + " does not exist.");
            }
            // Returns thisTable
            var thisTable = {
                get exists() {
                    return file.tables[tableName] != undefined;
                },
                create: function () {
                    if (thisTable.exists) {
                        if (options.safeAndFriendlyErrors) {
                            throw new Error("The table \"" + tableName + "\" already exists in this database");
                        }
                        throw new Error("Table " + chalk.magenta(tableName) + " already exists in database " + chalk.cyan(filePath) + ".");
                    }
                    if (file.tables == undefined) {
                        file.tables = {};
                    }
                    file.tables[tableName] = { cols: [], rows: [] };
                    writeDBFile();
                },
                drop: function () {
                    var e_5, _a;
                    if (!thisTable.exists) {
                        if (options.safeAndFriendlyErrors) {
                            throw new Error("The table \"" + tableName + "\" does not exist in this database");
                        }
                        throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                    }
                    var table = new Table(file.tables[tableName]);
                    var colNames = [];
                    try {
                        for (var _b = __values(table.cols), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var col = _c.value;
                            colNames.push(col.name);
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                    // Try to delete all columns
                    thisTable.columns.drop(colNames);
                    delete file.tables[tableName];
                    writeDBFile();
                },
                get: function () {
                    if (!thisTable.exists) {
                        if (options.safeAndFriendlyErrors) {
                            throw new Error("The table \"" + tableName + "\" does not exist in this database");
                        }
                        throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                    }
                    return new Table(file.tables[tableName]);
                },
                get rowCount() {
                    return file.tables[tableName].rows.length;
                },
                get colCount() {
                    return file.tables[tableName].cols.length;
                },
                set data(value) {
                    file.tables[tableName].data = value;
                    writeDBFile();
                },
                get data() {
                    return file.tables[tableName].data;
                },
                columns: {
                    add: function (cols) {
                        var e_6, _a, e_7, _b, e_8, _c;
                        if (!thisTable.exists) {
                            if (options.safeAndFriendlyErrors) {
                                throw new Error("The table \"" + tableName + "\" does not exist in this database");
                            }
                            throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                        }
                        // Create map of existing table columns
                        var table = thisTable.get();
                        var tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]));
                        var existingCols = new Map();
                        try {
                            for (var _d = __values(table.cols), _e = _d.next(); !_e.done; _e = _d.next()) {
                                var col = _e.value;
                                existingCols.set(col.name, col);
                            }
                        }
                        catch (e_6_1) { e_6 = { error: e_6_1 }; }
                        finally {
                            try {
                                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                            }
                            finally { if (e_6) throw e_6.error; }
                        }
                        try {
                            try {
                                // Check if each column is valid
                                for (var cols_1 = __values(cols), cols_1_1 = cols_1.next(); !cols_1_1.done; cols_1_1 = cols_1.next()) {
                                    var col = cols_1_1.value;
                                    if (col.name == undefined || col.dataType == undefined) {
                                        if (options.safeAndFriendlyErrors) {
                                            throw new Error("A column should have at least the 'name' and 'dataType' properties. You specified this:\n" + JSON.stringify(col, null, 2));
                                        }
                                        throw new Error("A column should have at least the 'name' and 'dataType' properties. Got: " + chalk.red(JSON.stringify(col, null, 2)) + ".");
                                    }
                                    if (existingCols.has(col.name)) {
                                        if (options.safeAndFriendlyErrors) {
                                            throw new Error("The column \"" + col.name + "\" already exists in this table.");
                                        }
                                        throw new Error("Column " + chalk.yellow(col.name) + " already exists in table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ".");
                                    }
                                }
                            }
                            catch (e_7_1) { e_7 = { error: e_7_1 }; }
                            finally {
                                try {
                                    if (cols_1_1 && !cols_1_1.done && (_b = cols_1.return)) _b.call(cols_1);
                                }
                                finally { if (e_7) throw e_7.error; }
                            }
                            try {
                                // Add each column
                                for (var cols_2 = __values(cols), cols_2_1 = cols_2.next(); !cols_2_1.done; cols_2_1 = cols_2.next()) {
                                    var col = cols_2_1.value;
                                    // Handle primaryKey and foreignKey
                                    var foreignKey = col.foreignKey;
                                    if (foreignKey != undefined) {
                                        var foreignCol = thisDb.table(foreignKey.table).get().getCol(foreignKey.column);
                                        if (foreignCol.constraints == undefined) {
                                            if (options.safeAndFriendlyErrors) {
                                                throw new Error("The column \"" + col.name + "\" could not be added to this table because you specified that the values should be linked with the (foreign) column \"" + foreignKey.column + "\" of the table \"" + foreignKey.table + "\". The latter column does not have the 'primaryKey' constraint, which is required to do this.");
                                            }
                                            throw new Error("Could not add column " + chalk.yellow(col.name) + " to table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because its foreignKey links to a non-primaryKey column. column " + foreignKey.column + " of table " + foreignKey.table + " must have the primaryKey constraint.");
                                        }
                                        if (!foreignCol.constraints.includes('primaryKey')) {
                                            if (options.safeAndFriendlyErrors) {
                                                throw new Error("The column \"" + col.name + "\" could not be added to this table because you specified that the values should be linked with the (foreign) column \"" + foreignKey.column + "\" of the table \"" + foreignKey.table + "\". The latter column does not have the 'primaryKey' constraint, which is required to do this.");
                                            }
                                            throw new Error("Could not add column " + chalk.yellow(col.name) + " to table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because its foreignKey links to a non-primaryKey column. column " + foreignKey.column + " of table " + foreignKey.table + " must have the primaryKey constraint.");
                                        }
                                        if (foreignCol.linkedWith == undefined) {
                                            foreignCol.linkedWith = [];
                                        }
                                        foreignCol.linkedWith.push({ table: tableName, column: col.name });
                                    }
                                    table.cols.push(col);
                                }
                            }
                            catch (e_8_1) { e_8 = { error: e_8_1 }; }
                            finally {
                                try {
                                    if (cols_2_1 && !cols_2_1.done && (_c = cols_2.return)) _c.call(cols_2);
                                }
                                finally { if (e_8) throw e_8.error; }
                            }
                            writeDBFile();
                        }
                        catch (err) {
                            // Restore changes on error
                            file.tables[tableName] = tableBackup;
                            writeDBFile();
                            throw err;
                        }
                    },
                    drop: function (colNames) {
                        var e_9, _a;
                        if (!thisTable.exists) {
                            if (options.safeAndFriendlyErrors) {
                                throw new Error("The table \"" + tableName + "\" does not exist in this database");
                            }
                            throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                        }
                        var table = thisTable.get();
                        var tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]));
                        try {
                            try {
                                for (var colNames_2 = __values(colNames), colNames_2_1 = colNames_2.next(); !colNames_2_1.done; colNames_2_1 = colNames_2.next()) {
                                    var colName = colNames_2_1.value;
                                    var col = table.getCol(colName);
                                    if (col == undefined) {
                                        if (options.safeAndFriendlyErrors) {
                                            throw new Error("You cannot drop the column \"" + colName + "\", since it does not exist in this table.");
                                        }
                                        throw new Error("Column " + chalk.yellow(colName) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + " does not exist.");
                                    }
                                    // Check linkedWith relations
                                    var linkedWith = col.linkedWith, foreignKey = col.foreignKey;
                                    if (linkedWith != undefined) {
                                        if (linkedWith.length > 0) {
                                            if (options.safeAndFriendlyErrors) {
                                                throw new Error("You cannot drop the column \"" + colName + "\", since it is linked to these columns:\n" + linkedWith.map(function (link) { return "Column \"" + link.column + "\" of Table \"" + link.table + "\""; }).join(', and ') + ".\nIn order to drop this column, you must drop the columns it is linked to first.");
                                            }
                                            throw new Error("Could not drop column " + chalk.yellow(colName) + " because it is a primaryKey linked to these columns:\n" + chalk.cyan(JSON.stringify(linkedWith, null, 2)) + "\nIn order to drop this column, you must drop the columns it is linked to first.");
                                        }
                                    }
                                    // Unlink foreignKey relation, if necessary
                                    if (foreignKey != undefined) {
                                        var foreignCol = thisDb.table(foreignKey.table).get().getCol(foreignKey.column);
                                        for (var i = 0; i < foreignCol.linkedWith.length; i++) {
                                            var linkedCol = foreignCol.linkedWith[i];
                                            if (linkedCol.table == tableName && linkedCol.column == colName) {
                                                foreignCol.linkedWith.splice(i, 1);
                                            }
                                        }
                                    }
                                    // Delete column from table.cols
                                    for (var i = 0; i < file.tables[tableName].cols.length; i++) {
                                        var colOfTable = file.tables[tableName].cols[i];
                                        if (colOfTable.name == colName) {
                                            table.cols.splice(i, 1);
                                        }
                                    }
                                }
                            }
                            catch (e_9_1) { e_9 = { error: e_9_1 }; }
                            finally {
                                try {
                                    if (colNames_2_1 && !colNames_2_1.done && (_a = colNames_2.return)) _a.call(colNames_2);
                                }
                                finally { if (e_9) throw e_9.error; }
                            }
                            writeDBFile();
                        }
                        catch (err) {
                            // Restore changes on error
                            file.tables[tableName] = tableBackup;
                            writeDBFile();
                            throw err;
                        }
                    }
                },
                insert: function (rows, rowNum) {
                    var e_10, _a, e_11, _b;
                    if (!thisTable.exists) {
                        if (options.safeAndFriendlyErrors) {
                            throw new Error("The table \"" + tableName + "\" does not exist in this database.");
                        }
                        throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                    }
                    var table = thisTable.get();
                    var tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]));
                    try {
                        try {
                            for (var rows_1 = __values(rows), rows_1_1 = rows_1.next(); !rows_1_1.done; rows_1_1 = rows_1.next()) {
                                var row = rows_1_1.value;
                                var newRow = [];
                                var _loop_2 = function (col) {
                                    var e_12, _a, e_13, _b;
                                    var el = row[col.name];
                                    var dataTypeParsedEl = void 0;
                                    // Set to default if undefined
                                    if (el == undefined && col.default != undefined) {
                                        el = col.default;
                                    }
                                    // Check for dataType
                                    try {
                                        dataTypeParsedEl = new dataTypes[col.dataType](el);
                                    }
                                    catch (err) {
                                        if (options.safeAndFriendlyErrors) {
                                            throw new Error("The value \"" + el + "\" could not be inserted into column \"" + col.name + "\" of this table, because it could not be converted to dataType \"" + col.dataType + "\"");
                                        }
                                        throw new Error("Could not insert value " + chalk.red(el) + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", beacuse it could not be converted to dataType " + chalk.green(col.dataType) + ".");
                                    }
                                    // Check constraints
                                    if (col.constraints != undefined) {
                                        // autoIncrement
                                        if (col.constraints.includes('autoIncrement')) {
                                            var table_1 = thisTable.get();
                                            var prevNumber = (rowNum == undefined)
                                                ? (table_1.rows.length > 0)
                                                    ? table_1.rows[table_1.rows.length - 1][col.name]
                                                    : 0
                                                : (rowNum > 0)
                                                    ? table_1.rows[rowNum - 1][col.name]
                                                    : 0;
                                            if (el == null) {
                                                el = prevNumber + 1;
                                            }
                                            var nextNumber = (rowNum == undefined)
                                                ? Infinity
                                                : (rowNum < table_1.rows.length - 1)
                                                    ? table_1.rows[rowNum + 1][col.name]
                                                    : Infinity;
                                            if (el < prevNumber && el > nextNumber) {
                                                if (options.safeAndFriendlyErrors) {
                                                    throw new Error("The value \"" + el + "\" could not be inserted into column \"" + col.name + "\" of this table, because this column has the 'autoIncrement' constraint. Just leave this field empty or insert a value bigger than " + prevNumber + " and smaller than " + nextNumber + ".");
                                                }
                                                throw new Error("Could not insert " + chalk.red(el) + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " " + ((rowNum != undefined) ? "at row at index " + rowNum : '') + " of database " + chalk.cyan(filePath) + ", because this column has the " + chalk.grey('autoIncrement') + " constraint. Leave this column empty or insert a value bigger than " + prevNumber + " and smaller than " + nextNumber + ".");
                                            }
                                            dataTypeParsedEl = new dataTypes.Int(el);
                                        }
                                        // notNull
                                        if (col.constraints.includes('notNull')) {
                                            // Todo: Should a notNull column be able to have a default value?
                                            if (el == undefined) {
                                                if (options.safeAndFriendlyErrors) {
                                                    throw new Error("Could not insert en empty value into the column \"" + col.name + "\" of this table, since this column has the 'autoIncrement' constraint. Fill in this column");
                                                }
                                                throw new Error("Could not insert " + chalk.red('null') + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because this column has the " + chalk.grey('autoIncrement') + " constraint. Fill in this column.");
                                            }
                                        }
                                        // unique
                                        if (col.constraints.includes('unique')) {
                                            try {
                                                // Todo: use memory tricks to make cheking for unique faster
                                                for (var _c = (e_12 = void 0, __values(thisTable.get().rows)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                                    var row_1 = _d.value;
                                                    if (el == row_1[col.name]) {
                                                        if (options.safeAndFriendlyErrors) {
                                                            throw new Error("The value \"" + el + "\" could not be inserted into column \"" + col.name + "\" of this table, because this column has the 'unique' constraint. This means that you cannot insert duplicate values. The value \"" + el + "\" has already been entered in this row:\n" + JSON.stringify(row_1, null, 2) + ".");
                                                        }
                                                        throw new Error("Could not insert " + chalk.red(el) + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because this column has the " + chalk.grey('unique') + " constraint. The value has already been entered in this row:\n" + chalk.red(JSON.stringify(row_1, null, 2)) + ".");
                                                    }
                                                }
                                            }
                                            catch (e_12_1) { e_12 = { error: e_12_1 }; }
                                            finally {
                                                try {
                                                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                                                }
                                                finally { if (e_12) throw e_12.error; }
                                            }
                                        }
                                        // primaryKey
                                        if (col.constraints.includes('primaryKey')) {
                                            // Check for notNull
                                            if (el == undefined) {
                                                if (options.safeAndFriendlyErrors) {
                                                    throw new Error("Could not insert en empty value into the column \"" + col.name + "\" of this table, since this column has the 'primaryKey' constraint. Fill in this column");
                                                }
                                                throw new Error("Could not insert " + chalk.red('null') + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because this column has the " + chalk.grey('primaryKey') + " constraint. Fill in this column.");
                                            }
                                            // Check for unique
                                            // primaryKey + autoIncrement should not interfere with each other
                                            if (!col.constraints.includes('autoIncrement')) {
                                                try {
                                                    for (var _e = (e_13 = void 0, __values(thisTable.get().rows)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                                        var row_2 = _f.value;
                                                        if (el == row_2[col.name]) {
                                                            if (options.safeAndFriendlyErrors) {
                                                                throw new Error("Could not insert the value \"" + el + "\" into the column \"" + col.name + "\" of this table, since this column has the 'primaryKey' constraint. This means that you cannot insert duplicate values. The value \"" + el + "\" has already been entered in this row:\n" + JSON.stringify(row_2, null, 2) + ".");
                                                            }
                                                            throw new Error("Could not insert " + chalk.red(el) + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because this column has the " + chalk.grey('primaryKey') + " constraint. The value has already been entered in this row:\n" + chalk.red(JSON.stringify(row_2, null, 2)) + ".");
                                                        }
                                                    }
                                                }
                                                catch (e_13_1) { e_13 = { error: e_13_1 }; }
                                                finally {
                                                    try {
                                                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                                                    }
                                                    finally { if (e_13) throw e_13.error; }
                                                }
                                            }
                                        }
                                    }
                                    // Check foreignKey relations
                                    if (col.foreignKey != undefined) {
                                        // Check if value exists in foreign table
                                        var foreignValue = thisDb
                                            .table(col.foreignKey.table)
                                            .get()
                                            .where(function (row) { return row[col.name] == el; });
                                        if (foreignValue == undefined) {
                                            if (options.safeAndFriendlyErrors) {
                                                throw new Error("Could not insert the value \"" + el + "\" into the column \"" + col.name + "\" of this table, since this column linked with the (foreign) column \"" + col.foreignKey.column + "\" of the table \"" + col.foreignKey.table + "\". This means that the value you put in this field should also exist in the latter column. This is not the case.\n\nIn order to insert this value here, first insert a row with the value \"" + el + "\" into the (foreign) column \"" + col.foreignKey.column + "\" of the table \"" + col.foreignKey.column + "\".");
                                            }
                                            throw new Error("Could not insert " + chalk.red(el) + " into column " + chalk.yellow(col.name) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because this column has a foreignKey to table '" + col.foreignKey.table + "', column '" + col.foreignKey.column + "'. This value was not found in the foreign column.");
                                        }
                                    }
                                    newRow.push(dataTypeParsedEl.value);
                                };
                                try {
                                    for (var _c = (e_11 = void 0, __values(table.cols)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                        var col = _d.value;
                                        _loop_2(col);
                                    }
                                }
                                catch (e_11_1) { e_11 = { error: e_11_1 }; }
                                finally {
                                    try {
                                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                                    }
                                    finally { if (e_11) throw e_11.error; }
                                }
                                if (rowNum != undefined) {
                                    // Overwrite
                                    file.tables[tableName].rows[rowNum] = newRow;
                                }
                                else {
                                    // Append
                                    file.tables[tableName].rows.push(newRow);
                                }
                            }
                        }
                        catch (e_10_1) { e_10 = { error: e_10_1 }; }
                        finally {
                            try {
                                if (rows_1_1 && !rows_1_1.done && (_a = rows_1.return)) _a.call(rows_1);
                            }
                            finally { if (e_10) throw e_10.error; }
                        }
                        writeDBFile();
                    }
                    catch (err) {
                        // Restore changes on error
                        file.tables[tableName] = tableBackup;
                        writeDBFile();
                        throw err;
                    }
                },
                update: function (newRow, where) {
                    if (!thisTable.exists) {
                        if (options.safeAndFriendlyErrors) {
                            throw new Error("The table \"" + tableName + "\" does not exist in this database");
                        }
                        throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                    }
                    var table = thisTable.get();
                    var tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]));
                    var updated = 0;
                    try {
                        for (var i = 0; i < table.rows.length; i++) {
                            var row = table.rows[i];
                            row.rowNum = i;
                            if (where(row)) {
                                // Update this row
                                var insertRow = __assign(__assign({}, row), newRow);
                                thisTable.insert([insertRow], i);
                                updated++;
                            }
                        }
                        // We do not have to call writeDBFile, since table.insert does this
                    }
                    catch (err) {
                        // Restore changes on error
                        file.tables[tableName] = tableBackup;
                        writeDBFile();
                        throw err;
                    }
                    return updated;
                },
                delete: function (where) {
                    var e_14, _a;
                    if (!thisTable.exists) {
                        if (options.safeAndFriendlyErrors) {
                            throw new Error("The table \"" + tableName + "\" does not exist in this database");
                        }
                        throw new Error("Table " + chalk.magenta(tableName) + " does not exist in database " + chalk.cyan(filePath) + ".");
                    }
                    var table = thisTable.get();
                    // Get map of linked columns
                    var linkedColumns = new Map();
                    try {
                        for (var _b = __values(table.cols), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var col = _c.value;
                            if (col.linkedWith != undefined) {
                                linkedColumns.set(col.name, col.linkedWith);
                            }
                        }
                    }
                    catch (e_14_1) { e_14 = { error: e_14_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_14) throw e_14.error; }
                    }
                    var tableBackup = JSON.parse(JSON.stringify(file.tables[tableName]));
                    var deleted = 0;
                    try {
                        var i = 0;
                        var _loop_3 = function () {
                            var e_15, _a, e_16, _b;
                            var rowTryingToDelete = thisTable.get().rows[i];
                            if (rowTryingToDelete == undefined) {
                                return "break";
                            }
                            rowTryingToDelete.rowNum = i;
                            if (where(rowTryingToDelete)) {
                                try {
                                    // Delete this row
                                    for (var _c = (e_15 = void 0, __values(linkedColumns.entries())), _d = _c.next(); !_d.done; _d = _c.next()) {
                                        var entry = _d.value;
                                        var linkedColName = entry[0];
                                        var linkedCols = entry[1];
                                        var _loop_4 = function (linkedCol) {
                                            // Check if the linked column does not depend on the value we are trying to delete
                                            var thisTableCol = thisTable.get().getCol(linkedColName);
                                            var linkedTable = thisDb.table(linkedCol.table);
                                            var search = linkedTable.get().where(function (row) { return row[linkedCol.column] == rowTryingToDelete[thisTableCol.name]; });
                                            var foundValues = JSON.stringify(search.rows, null, 2);
                                            // Throw error if the value exists
                                            if (search.rows.length > 0) {
                                                if (options.safeAndFriendlyErrors) {
                                                    throw new Error("Could not delete the following row:\n" + JSON.stringify(rowTryingToDelete, null, 2) + "\n from this table, since the column \"" + linkedColName + "\" (which holds the value \"" + rowTryingToDelete[linkedColName] + "\") is linked to the (foreign) column \"" + linkedCol.column + "\" of the table \"" + linkedCol.table + "\". The latter column is dependent on this value.\n\nIn order to delte the value \"" + rowTryingToDelete[linkedColName] + "\" from the column \"" + linkedColName + "\" in this table, first delete these rows from the table \"" + linkedCol.table + "\":\n" + foundValues + ".");
                                                }
                                                throw new Error("Could not delete row\n" + chalk.red(JSON.stringify(rowTryingToDelete, null, 2)) + "\nfrom column " + chalk.yellow(linkedColName) + " of table " + chalk.magenta(tableName) + " of database " + chalk.cyan(filePath) + ", because this column is linked to a foreignKey from column " + chalk.yellow(linkedCol.column) + ", from table " + chalk.magenta(linkedCol.table) + ". The following dependent records were found in the linked column. First remove those records:\n" + chalk.red(foundValues) + ".");
                                            }
                                        };
                                        try {
                                            for (var linkedCols_1 = (e_16 = void 0, __values(linkedCols)), linkedCols_1_1 = linkedCols_1.next(); !linkedCols_1_1.done; linkedCols_1_1 = linkedCols_1.next()) {
                                                var linkedCol = linkedCols_1_1.value;
                                                _loop_4(linkedCol);
                                            }
                                        }
                                        catch (e_16_1) { e_16 = { error: e_16_1 }; }
                                        finally {
                                            try {
                                                if (linkedCols_1_1 && !linkedCols_1_1.done && (_b = linkedCols_1.return)) _b.call(linkedCols_1);
                                            }
                                            finally { if (e_16) throw e_16.error; }
                                        }
                                    }
                                }
                                catch (e_15_1) { e_15 = { error: e_15_1 }; }
                                finally {
                                    try {
                                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                                    }
                                    finally { if (e_15) throw e_15.error; }
                                }
                                file.tables[tableName].rows.splice(i, 1);
                                deleted++;
                            }
                            else {
                                i++;
                            }
                        };
                        while (true) {
                            var state_1 = _loop_3();
                            if (state_1 === "break")
                                break;
                        }
                        writeDBFile();
                    }
                    catch (err) {
                        // Restore changes on error
                        file.tables[tableName] = tableBackup;
                        writeDBFile();
                        throw err;
                    }
                    return deleted;
                }
            };
            return thisTable;
        }
    };
    return thisDb;
};
