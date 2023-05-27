import { Lite } from "./lite";

export const MEMORY_BREAK = "\n\n **Estado de la memoria**: \n";
export const EMPTY_MEMORY = [{ "topic": "Empty" }];
export const MEMORY_PROMPT = "Usa la siguiente memoria para contextualizar tu respuesta: %memory.";
export const ERROR_TOPIC = "Error handling";

export class BM extends Lite {

	static instance: BM;
	static memory: any[] = EMPTY_MEMORY;

    static setEmpty() {
        this.memory = EMPTY_MEMORY;
    }

	static getInstance() {
		if (!this.instance) {
			this.instance = new BM();
		}
		return this.instance
	}

	static setAnalytics(newAnalytics: any) {

		console.log("Updating Memory: ");
		if (newAnalytics.topic == ERROR_TOPIC) {
			console.warn("ERROR_TOPIC found, skipping...");
			return;
		}
		this.memory[0] = JSON.stringify(newAnalytics);
	}

	static getMemAsString() {

		if (this.memory && this.memory[0] && this.memory[0].topic && this.memory[0].topic == "Empty") {
			return "";
		}
		return JSON.stringify(this.memory[0]);
	}

	static getMemAsChunkChain(chunkSize: number): string[] {
		return this.getDataAsChunkChain(chunkSize, this.getMemAsString());
	}

	static getDataAsChunkChain(chunkSize: number, data: string): string[] {
		const chunks = [];
		let i = 0, n = data.length;
		while (i < n) {
			chunks.push(data.slice(i, i += chunkSize));
		}
		return chunks;
	}

	static getAsJsonMarkdown() {

		return "```json \n" + this.getMemAsString() + "\n```";
	}

	static getMemAsPrompt() {
		return this.getMemAsString() ?
			MEMORY_PROMPT.replace("%memory", BM.getMemAsString()) :
			"";
	}

	static setMemoryFromStringifiedKeys(keys: string, debugInfo: number): boolean {
		let foundMemory = false;
		try {
			this.memory = [JSON.parse(keys)];
			foundMemory = true;
		  } catch (error) {
			console.warn("Invalid data at:", debugInfo, keys);
		}
		return foundMemory;
	}

	static setMemoryFromMergeRequest(reply: string){
		this.memory[0] = this.parseResultToJson(reply);
	}

	static parseResultToJson(result: string): any {
		try {
			return JSON.parse(result);
		} catch (error) {
			console.log("Failed to parse Result Analytics", result);
			return {};
		}
	}

}