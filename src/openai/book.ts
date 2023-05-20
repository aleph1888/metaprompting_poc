import path = require("path");
const auth = require('../../package.json');
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { Entry } from "./memoria/lite";
import { userLabels } from "./openai";
import { Console } from "console";

export const EMPTY_LABEL = "EMPTY";
export interface EntryDictionary {
    [userOption: string]: string;
}

export function convertDate(date: Date) {
    return (
        date.getFullYear() +
        "-" +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        "-" +
        ("0" + date.getDate()).slice(-2) +
        "_" +
        ("0" + date.getHours()).slice(-2) +
        "-" +
        ("0" + date.getMinutes()).slice(-2) +
        "-" +
        ("0" + date.getSeconds()).slice(-2)
    );
}

export class Book {

    fsError: boolean;
    db: string = "data.db";
    title: string;
    uiIndex: EntryDictionary = {};

    constructor(public folder: string) {

        if (!folder) {
            this.fsError = true;
            return;
        }
		this.folder = this.folder.trim();
		this.title = folder;

		let fpath = path.join(auth.openai.memory, folder);

		if (!existsSync(fpath)) {

			try {
				mkdirSync(fpath);
				this.prepareExportFolder();
                this.fsError = false;
			} catch(e) {
                this.fsError = true;
				return;
			}
		}
    }

	static exists(key: string): boolean {
		return existsSync(
			path.join(auth.openai.memory, key)
		);
	}

    static getBooksList(): string {

		const dir = auth.openai.memory;
		const files = readdirSync(dir);

		let str = "";
		files.forEach((file) => {
			str += `- ${file}\n`;
		});
		const label = userLabels
			.MENU_TITLE_BOOK_LIST.replace("%items", files.length.toString());
		return label + "\n" + str;
	}

    getPath(): string {
        return path.join(auth.openai.memory, this.folder)
    }

    getDbFile(): string {
        return path.join(this.getPath(), this.db);
    }

    getExportFolder(): string {
        return path.join(this.getPath(), "export");
    }

    prepareExportFolder() {

        const folder = this.getExportFolder();

        if (!existsSync(folder)) {
			console.log("Creating export folder:", folder);
            mkdirSync(folder);
        }
    }

	exportRow(row: any) {

        console.log("Generating ExportFile for row. Current mood:", row.who);

        try {
			this.prepareExportFolder()
            const dateLabel = convertDate(new Date(row.timestamp));
            const filename = path.join(
                this.getExportFolder(),
                `${dateLabel}.md`
            );
            if (existsSync(filename)) {
                return;
            }
            console.log("*** Creating file for:", filename);
            writeFileSync(
                filename,
                `${row.id}-${dateLabel} \n # Who  \n ${row.who} \n  # Prompt \n  ${row.prompt}\n\n ## Keys\n\n \`\`\`json \n ${row.keys} \n \`\`\` \n\n ## Mem\n\n \`\`\`json \n ${row.mem} \n \`\`\` \n\n ## Content\n\n${row.content}`
            );
            return true;
        } catch (error) {
			console.warn("Generating ExportFile for row. Failed", error.message);
            return false;
        }

	}

    rowAsExportFileName(row: any) {
        return convertDate(new Date(row.timestamp)) + ".md";
    }

    getExportFilenameFullPath(row: any) {

        if (!row) return EMPTY_LABEL;

        const name = this.rowAsExportFileName(row);

        if (name == EMPTY_LABEL) {
            return EMPTY_LABEL;
        } else {
            return path.join(this.getExportFolder(), name);
        }
    }

	// This functions reduces de current list of file in memory folder.
	// It generates a list of files grouped by year, month, day and hour.
	async getBookEntriesAsMenuOption(dbRows: Entry[]): Promise<string> {

		console.log("Generating list for", this.title, "with", dbRows.length, "rows");

		if (!dbRows) return EMPTY_LABEL;

		// for each row in dbRows checks if fields has : simbol in the keys, if so, renames the key droping the : simbol
		dbRows.forEach((row, index) => {
			try {
			const keys = JSON.parse(row.keys);
			const newKeys = {};
			for (const key in keys) {
				const newKey = key.replace(":", "").replace("\\", "");
				newKeys[newKey] = keys[key];
			}
			dbRows[index].keys = JSON.stringify(newKeys);
			} catch (error) {
			}
		});

		this.uiIndex = { };

		const result = dbRows.reduce((acc, row, rIndex) => {

			// const fileDate = row.split("_")[0] + " " + (row.split("_")[1]).replace(/-/g, ":").replace(".md", "");
			const fileDate = row.timestamp;
			const date = new Date(fileDate);

			// console.log("*Parsing list memory for", fileDate);
			// console.log("Generating list for step", row, " date ", date, fileDate);
			const year = date.getFullYear();
			const month = ("0" + (date.getMonth() + 1)).slice(-2);
			const day = ("0" + date.getDate()).slice(-2);
			const hour = ("0" + date.getHours()).slice(-2);
			const min = ("0" + date.getMinutes()).slice(-2);
			const second = ("0" + date.getSeconds()).slice(-2);

			const filename = `${convertDate(date)}.md`;
			const filepath = path.join(auth.openai.memory, filename);
			const title = `${year}-${month}-${day} ${hour}:00`;

			// console.log("   - Searching for topic for row: ", row);
			const topicObj = this.getTopicFromRow(row);
			console.log(" - Building memory, topicObj: ", topicObj, year, month, day, hour, min, second);
			const dateLabel = convertDate(new Date(row.timestamp));
			this.uiIndex['s' + (rIndex + 1)] = dateLabel;
			const item = (rIndex + 1) + ": " + topicObj;
			// console.log("***MEMO -CHECK: index/topic/file ", rIndex , row, rIndex, topicObj);
			rIndex++;

			if (!acc[year]) {
			acc[year] = {};
			}
			if (!acc[year][month]) {
			acc[year][month] = {};
			}
			if (!acc[year][month][day]) {
			acc[year][month][day] = {};
			}
			if (!acc[year][month][day][hour]) {
			acc[year][month][day][hour] = {};
			}
			if (!acc[year][month][day][hour][min]) {
			acc[year][month][day][hour][min] = {};
			}
			if (!acc[year][month][day][hour][min][second]) {
			acc[year][month][day][hour][min][second] = item;
			}
			return acc;
		}, {});

		console.log("**** Producing the UI memory list, for n", dbRows.length);
		let output = userLabels.MENU_TITLE_PAGES_LIST
			.replace("%items", dbRows.length + "") + "\n";

		for (const year in result) {
			output += `Año: ${year}\n`;
			for (const month in result[year]) {
			output += ` - Mes: ${month}\n`;
			for (const day in result[year][month]) {
				output += `   - Día: ${day}\n`;
				for (const hour in result[year][month][day]) {
				output += `     - Hora: ${hour}\n `;
				for (const minute in result[year][month][day][hour]) {
					for (const second in result[year][month][day][hour][minute]) {
					output += `       - ${minute}:${second} -> ${result[year][month][day][hour][minute][second]}\n`;
					}
				}
				}
			}
			}
		}
		return output;
	}

	getTopicFromRow(row: any) {

		console.log("   - Searching for topic for row: ", row?.id);
		let topic = this.getTopicFromMemRow(row, "keys");
		if (!topic) {

			console.log("   - No topic found in keys, searching in deep keys");
			topic = this.getDeepTopicFromRow(row);
			if (!topic) {
				console.log("   - No topic found in deep keys, searching in mem");
				topic = this.getTopicFromMemRow(row, "mem");
			}
		}
		return (topic || "").replace("\n", "");

	}

	getDeepTopicFromRow(row: any) {
		let strkeys = "";
		let topicObj;
		try {
			console.log("");
			if (row && typeof row.keys === "object") {
			console.log("Key.topic.found!!")
			topicObj = row.keys.Topic;
			} else {
			const init = row.keys.indexOf("{");
			const final = row.keys.indexOf("}");

			strkeys = row.keys.substring(init, final + 1)
			topicObj = JSON.parse(strkeys);
			// console.log("   - Memory has been readed! Got mem.keys object with topic:", topicObj.Topic);
			if (topicObj.Topic) {
				topicObj = topicObj.Topic;
			}
			}

			// console.log("Extracting topic from ", index, topicObj.Topic);
			if (!topicObj.Topic) {
			// console.log("No topic found for ", index, topicObj);
			}
		} catch (error) {

			console.log("** COULD NOT PARSE DE DB KEYS FIELD TO EXTRACT THE TOPIC. Keys", row?.keys, "StringKeys", strkeys);
			// console.log("*** No topic at", row, rIndex, topicObj, error.message);
			topicObj = "?\n";
		}
		return topicObj;
	}

	getTopicFromMemRow(row: any, field: string) {
		let topic = "";
		try
		{
			const mem = JSON.parse(row[field]);
			topic = mem.Topic || mem.topic;
		} catch (error) {

		}
		return (topic || "").replace("\n", "");
	}
}