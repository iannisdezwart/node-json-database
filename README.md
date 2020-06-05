## Installation

```sh
$ npm install --save node-json-database
```

## Usage

Quick Tutorial:

```ts
import { db } from 'node-json-database'

// Create a database called 'myDB'
const myDB = db('myDB')
myDB.create()

// Create a table in the database, called 'friends'
const friendsTable = myDB.table('friends')
friendsTable.create()

// Set the columns
friendsTable.columns.add([
	{
		name: 'firstName',
		dataType: 'String'
	},
	{
		name: 'lastName',
		dataType: 'String'
	},
	{
		name: 'birthday',
		dataType: 'DateTime'
	},
	{
		name: 'favouriteNumber',
		dataType: 'Int'
	}
])

// Insert values into the table
friendsTable.insert([
	{
		firstName: 'John',
		lastName: 'Doe',
		birthday: new Date('01 Jan 1970').getTime(),
		favouriteNumber: 42
	},
	{
		firstName: 'Johnny',
		lastName: 'Doe',
		birthday: new Date('01 Jan 2000').getTime(),
		favouriteNumber: 69
	}
])

// Find all records with 'Johnny' as firstName
const search = friendsTable.get().where(row => row.firstName == 'Johnny')

console.log(search.rows)

// Console output:

// [
// 	{
// 		firstName: 'Johnny',
// 		lastName: 'Doe',
// 		birthday: 946684800000, // This is a UNIX timestamp
// 		favouriteNumber: 69
// 	}
// ]
```

## License

ISC © [Iannis de Zwart](iannis__@hotmail.com)
