import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { BM } from "./memoria/base-memory";
import { Api } from "./api";
import { Book } from "./book";
import { existsSync, mkdirSync } from "fs";
const auth = require('../../package.json');
export const ANALYTICS_MARK = "**Análisis:**";
export const ANALYTICS_KEYS = ["Topic:", "Context:", "Intent:", "Named Entities:", "Keywords:", "Sentiment:"];
export const ANALYTICS_DATA = "Topic, context, intent, named entities, keywords, y sentiment";
export const ANALYTICS_DEFINITION = "un análisis del Prompt que usando NLP devuelva: " + ANALYTICS_DATA + ". No incluyas comentarios del análisis, solo la lista de puntos.";
export const ANALYTICS_PROMPT = "Añade al final de tu respuesta la marca " + ANALYTICS_MARK + " y tras ella agrega " + ANALYTICS_DEFINITION;
export const ANALYTICS_PROMPT_REQUERY_KEYS = "Crea un json con los campos de" + ANALYTICS_DEFINITION + " El prompt para analizar es: %prompt.";
export const ANALYTICS_MERGE_PROMPT = "Fusiona estas dos analíticas: [%A1] y [%A2]. Fusiona ambas estadísticas usando NLP y devuelve " + ANALYTICS_DATA + ". En la fusión debe discriminarse positivamente la segunda estadística.";

export interface IAnalytics {
	Topic: string;
	Context: string;
	Intent: string;
	NamedEntities: string;
	Keywords: string;
	Sentiment: string;
}

export class Analytics {

	mb: BM = BM.getInstance();
	api: Api = new Api();

	constructor() {
		if (!existsSync(auth.openai.memory)) {
			mkdirSync(auth.openai.memory);
		}
	}

	getAnalyticsFromResponse(response: string): IAnalytics | any  {

		let newAnalytics = null;
		const newData = response.split("\n");
		newData.forEach((line) => {
		  ANALYTICS_KEYS.forEach((key) => {
			if (line.toLocaleLowerCase().indexOf(key.toLowerCase()) > -1) {
			  if (!newAnalytics) newAnalytics = {};
			  newAnalytics[key.replace(":", "")] = line.replace('- ' + key + ': ', "").replace(key, "").replace("-  ", "").replace("- ****", "") + "\n";
			}
		  });
		});
		return newAnalytics
	}

	async memoryIsEmpty(promptText: string, newAnalytics: any, response: string, mood: string, book: Book) {

		console.log("Current memory state...");
		if (!BM.getMemAsString() || BM.memory.length == 0) {
			console.log("Current memory state... EMPTY");
			console.log(" ");
			console.warn("First time, new memory:\n", JSON.stringify(newAnalytics, null, "\t"));
			console.log(" ");
			BM.setAnalytics(newAnalytics);
			await this.mb.add(book, {
				who: mood,
				timestamp: new Date(),
				prompt: promptText,
				keys: JSON.stringify(newAnalytics),
				mem: "",
				content: response
			});
			return true;
		}
		console.log("Current memory state... USED");
		return false;

	}

	async hasAnalytics(promptText: string, newAnalytics: any, response: string, mood: string, book: Book) {

		if (!newAnalytics) {
			console.warn("- ", new Date().toTimeString(), "analyticsIsEmpty!!!");
			await this.mb.add(book, {
				who: mood,
				timestamp: new Date(),
				prompt: promptText,
				keys: "",
				mem: BM.getMemAsString(),
				content: response
			});
			return false;
		}
		return true;
	}

	async processAnalytics(promptText: string, newAnalytics: any, response: string,
		mood: string, book: Book): Promise<boolean> {

		console.log("Processing analytics...");
		const needToMerge = await this.memoryIsEmpty(promptText, newAnalytics, response, mood, book);
		if (needToMerge) {
			console.log("Memory is new son no need to merge... ");
			return;
		} else {
			console.log("Memory is not new so we need to merge... ");
		}

		console.log(" ");
		console.log("The new analytics memory to merge:\n"/*, newAnalytics*/);
		console.log(" ");
		const prompt = ANALYTICS_MERGE_PROMPT
			.replace("%A1", BM.getMemAsString()).replace("%A2", JSON.stringify(newAnalytics, null, "\t"));

		try {
			const messages = [
				{"role": ChatCompletionRequestMessageRoleEnum.System, "content": prompt}
			];
			const completion = await this.api.send(messages);
			if (completion.ok) {
				const result = completion.data;

				console.log(" ");
				console.log("Prompting memory MERGE result:\n"/*, result*/);
				console.log(" ");

				BM.setMemoryFromMergeRequest(result);

				await this.mb.add(book, {
					who: mood,
					timestamp: new Date(),
					prompt: promptText,
					keys: JSON.stringify(newAnalytics),
					mem: BM.getMemAsString(),
					content: response
				});
				console.log(" ");
				console.log("Memory updated:\n", /*BM.memory*/);
				console.log(" ");
				return true;
			}

		} catch(error) {
			// Consider adjusting the error handling logic for your use case
			if (error.response) {
				console.error(error.response.status, error.response.data);
			} else {
				console.error(`Error with OpenAI API request: ${error.message}`);
			}
			await this.mb.add(book, {
				who: mood,
				timestamp: new Date(),
				prompt: promptText,
				keys: JSON.stringify(newAnalytics),
				mem: BM.getMemAsString(),
				content: response
			});
		}
		return false;
	}

	async requeryAnalyticKeys(requested: {keys: any}, response: string): Promise<boolean> {

		try {
			const prompt = ANALYTICS_PROMPT_REQUERY_KEYS.replace("%prompt", response);
			const messages = [
			{"role": ChatCompletionRequestMessageRoleEnum.User, "content": prompt}
			];
			console.log("-", new Date().getTime(), "Prompting memory REQUERY keys:\n");
			const completion = await this.api.send(messages);
			if (completion.ok) {
				const result = completion.data;

				console.log(" ");
				console.log("Prompting memory REQUERY result:\n"/*, result*/);
				console.log(" ");

				requested.keys = BM.parseResultToJson(result);
			}
			return Object.keys(requested.keys).length > 0;

		} catch (error) {
			console.log("Error REQUERYING keys", error.message);
			return false;
		}
	}

}
