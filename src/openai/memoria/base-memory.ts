import { Lite } from "./lite";

export const MEMORY_BREAK = "\n\n **Estado de la memoria**: \n";
export const EMPTY_MEMORY = [{ "topic": "Empty" }];
export const MEMORY_PROMPT = "Usa la siguiente memoria para contextualizar tu respuesta: %memory.";

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
		this.memory[0] = JSON.stringify(newAnalytics);
	}

	static getMemAsString() {

		if (this.memory && this.memory[0] && this.memory[0].topic && this.memory[0].topic == "Empty") {
			return "";
		}
		return JSON.stringify(this.memory[0]);
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