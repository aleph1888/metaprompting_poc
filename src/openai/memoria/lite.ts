// Database driver for sqlite3 table. A class to handle objects with fields: timestamp (date); keys (string) and content (string). Use environment variable to set the sqlite3 file. Create separate sql schema. Create methods to add new object, seach by field keys and to export to json.
const auth = require('../../../package.json');

const fs = require("fs");

import { Database } from "sqlite3";
import { promisify } from "util";
import { Book } from "../book";

export interface Entry {
	id?: number,
	who: string,
	timestamp: Date;
	prompt: string;
	keys: string;
	mem: string;
	content: string;
}

export class Lite {
	db: Database;

	constructor() {
		if (!fs.existsSync(auth.openai.memory)) {
			fs.mkdirSync(auth.openai.memory);
		}
	}

	async init(book: Book) {

		console.log("Initializing ACCES for book:", book.getDbFile());

		if (!fs.existsSync(book.getPath())) {
			fs.mkdirSync(book.getPath());
		}

		if (!fs.existsSync(book.getDbFile())) {

			console.log("Creating database for book:", book.getDbFile());

			const db =  new Database(book.getDbFile());
			const run = promisify(db.run.bind(db));

			await run(`CREATE TABLE IF NOT EXISTS entries (
				id INTEGER PRIMARY KEY AUTOINCREMENT ,
				who TEXT,
				timestamp TEXT,
				prompt TEXT,
				keys TEXT,
				mem TEXT,
				content TEXT
			)`);

			db.close();

		}

		console.log("Database initialized");
	}

	async add(book: Book, entry: Entry) {

		console.log("Adding entry:"/*, entry*/);
		const db = await this.gDb(book);
		const run = promisify(db.run.bind(db));
		await run(
			`INSERT INTO entries (who, timestamp, prompt, keys, mem, content) VALUES ( ?, ?, ?, ?, ?, ?)`,
			entry.who,
			entry.timestamp.toISOString(),
			entry.prompt,
			entry.keys,
			entry.mem,
			entry.content
		);
		db.close();
	}

	async gDb(book: Book) {

		if (!book) {
			book = new Book("default");
		}

		await this.init(book);

		return new Database(book.getDbFile());
	}

	async search(book: Book, field: string, value: string) {

		console.log("Searching for:", field, value);

		const db = await this.gDb(book);
		const all = promisify(db.all.bind(db));
		const rows = await all(
			`SELECT id, who, timestamp, prompt, keys, mem, content FROM entries WHERE ${field} LIKE ?`,
			`%${value}%`
		);
		db.close();
		return rows.map((row) => ({
			id: row.id,
			who: row.who,
			timestamp: new Date(row.timestamp),
			prompt: row.prompt,
			keys: row.keys,
			mem: row.mem,
			content: row.content,
		}));
	}

	async getById(book: Book, value: number) {

		console.log("getById for:", value);

		const db = await this.gDb(book);
		const all = promisify(db.all.bind(db));
		const rows = await all(
			`SELECT id, who, timestamp, prompt, keys, mem, content FROM entries WHERE id = ${value}`
		);
		db.close();
		if (rows.length > 0) {
			return rows.map((row) => ({
			id: row.id,
			who: row.who,
			timestamp: new Date(row.timestamp),
			prompt: row.prompt,
			keys: row.keys,
			mem: row.mem,
			content: row.content,
			}))[0];
		} else {
			return null;
		}
	}

	async getAll(book: Book) {

		console.log("getAll for:", book.title);

		const db = await this.gDb(book);
		const all = promisify(db.all.bind(db));
		const rows = await all(
			`SELECT id, who, timestamp, prompt, keys, mem, content FROM entries ORDER BY timestamp ASC`
		);
		db.close();
		return rows.map((row) => ({
			id: row.id,
			who: row.who,
			timestamp: new Date(row.timestamp),
			prompt: row.prompt,
			keys: row.keys,
			mem: row.mem,
			content: row.content,
		}));
	}

	async exportMarkdown(book: Book) {

		const db = await this.gDb(book);
		const all = promisify(db.all.bind(db));
		const rows = await all(
			`SELECT id, who, timestamp, prompt, keys, mem, content FROM entries ORDER BY timestamp DESC`
		);

		book.prepareExportFolder();

		console.log("** Going to export all rows in db as markdown files. For rows: ", rows.length);
		rows.forEach((row, index) => {

			book.exportRow(row);
		});
		db.close();
	}

}
