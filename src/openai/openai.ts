import { Message } from "discord.js";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { Entry, Lite } from "./memoria/lite";
import { MessageAttachment } from 'discord.js';
import { existsSync } from "fs";
import { ANALYTICS_PROMPT, Analytics } from "./analytics";
import { BM, MEMORY_BREAK } from "./memoria/base-memory";
import { Api } from "./api";
import { Book } from "./book";
import { PROMPTS } from "./commands";

export enum userLabels {
	CANT_ACCESS_MEMORY = "La memoria no se puede leer:",
	EMPTY_MEMORY = "La memoria está vacía",
	MEMORY_NOT_FOUND = "No se ha encontrado la memoria",
	BOOK_SELECTED = "El libro actual ha sido cambiado a: ",
	BOOK_NAME_INVALID = "No se ha indicado o incorrecto el nombre de libro: solo letras y números.",
	MEMORY_MENU = "Menú de memoria",

	MENU_TITLE_PAGES_LIST = "\n - **Lista páginas** (%items): \n",
	MENU_TITLE_BOOK_LIST = "\n - **Lista libros** (%items): \n",
	BOOKS_INDEX = "Menú de libros",

	OPTIONS_MENU = "" +
	"\n - Para inicializar la memoria con un personaje: (usa **" + "dsa eres" + " " + "{nombre}" + "**)." +
	"\n - Para listar libros: (usa **" + "dsa mem" + " " + "book" + "**)." +
	"\n - Para seleccionar/crear uno: (usa **" + "dsa mem" + " " + "book" + " {nombre}**)." +
	"\n - Para listar las páginas del libro actual: (usa **" + "dsa mem" + "**)." +
	"\n - Para instalar una memoria: (usa **" + "dsa mem" + " " + "set" + " {índice}**)." +
	"\n - Para ver la memoria actual: (usa **" + "dsa memo" + "**).\n ",

	BOOK_ENTRIES_INDEX = "Libro actual: %book. \n",
	MEMORY_SCREEN = "soy: %mood. \n```json \n %memory \n```  \n"
}


const MARKDOWN_PROMPT = "Formatea todo con markdown resaltando en negrita las ideas principales, usa cursiva para las citas, etc; devuelve el código sin interpretar, para que lo pueda copiar. \n";

const MOOD_PROMPT = "Interpreta y responde como lo haría %mood. No te salgas del papel ni aclares que eres una inteligencia artificial. Contesta en primera persona del singular. ";
const MARKS_PROMPT = "Sitúa el foco de tu respuesta en responder a: %prompt."

const HELLO_PROMPT = PROMPTS.simple + " Preséntate. Di hola, quién eres, dónde vives, qué haces para ganarte la vida. Incluye una lista enumerada con tus hitos más importantes.";

export class OpenAI {

	api: Api = new Api();
	mood: string = "Amabot, un bot conversacional";

	lite: Lite;
	analytic: Analytics;
	book = new Book("axtershow");

	constructor() {
		this.lite = new Lite();
		this.analytic = new Analytics();
	}

	// function that receives a mood and stores it in class attribute
	public async setIdentity(message: Message) {
		this.mood = message.content.replace(PROMPTS.setIdentity, "");

		message.content = HELLO_PROMPT;
		BM.setEmpty();
		await this.triggerPrompt(message);
	}

	public async getMemory(message: Message) {

		message.content = userLabels.MEMORY_SCREEN
			.replace("%mood", this.mood)
			.replace("%memory", BM.getMemAsString());
		message.reply(message.content);

	}

	public async lookUpOrSetMemory(message: Message) {

		// await this.lite.exportMarkdown(this.book);

		let prompt = message.content.replace(PROMPTS.memory_access + " ", "");

		const isASetMemoryOrder = prompt.indexOf(PROMPTS.set) > -1;

		if (isASetMemoryOrder) {
			prompt = prompt.replace(PROMPTS.set, "");
			const key = parseInt(prompt);
			console.log("Getting PAGE for", key ? key : "", "isSet", isASetMemoryOrder);
			await this.doSetMemory(message, key);
			return;
		} else {
			// console.log("Checking if is a book memory order", prompt);
			const isABookMemoryOrder = prompt.indexOf(PROMPTS.book) > -1;
			if (isABookMemoryOrder) {
				console.log("Is a book memory order", isABookMemoryOrder);
				prompt = prompt.replace(PROMPTS.book, "").trim();
				const key = prompt;
				console.log("Getting BOOK for", key ? key : "");

				await this.replyBookCommand(message, key);
				return;
			}
		}

		const key = parseInt(prompt);
		if (!key) {
			// console.error("No key found in", prompt);
		}

		console.log("Loading PAGE or Listing. Page key?", prompt ? prompt : "");
		await this.replyPageCommand(message, key);
	}

	public async triggerPrompt(message: Message) {

		const prompt = message.content.replace(PROMPTS.simple, "");

		const response = await this.queryToApi(
			MOOD_PROMPT.replace("%mood", this.mood),
			prompt
		)

		const totalMessage = response.result + MEMORY_BREAK + BM.getAsJsonMarkdown();

		if (totalMessage.length > 1900) {
			console.log("Original message with lenght", totalMessage.length, "croping to 2 chunks of 1900");
			let finalMessage = totalMessage.substring(0, 1900);
			message.reply(finalMessage || "");
			finalMessage = totalMessage.substring(1900);
			message.reply(finalMessage || "");
		} else {
			message.reply(totalMessage || "");
		}

		await this.registerAnalytics(prompt, response.result, message);
	}

	private async queryToApi (mood: string, prompt: string): Promise<{ result: string }> {

		let result;

		const memory = BM.getMemAsPrompt();
		prompt = MARKS_PROMPT.replace("%prompt", prompt);
		const messages = [
			{"role": ChatCompletionRequestMessageRoleEnum.Assistant, "content": memory},
			{"role": ChatCompletionRequestMessageRoleEnum.User, "content": ANALYTICS_PROMPT},
			{"role": ChatCompletionRequestMessageRoleEnum.System, "content": MARKDOWN_PROMPT},
			{"role": ChatCompletionRequestMessageRoleEnum.User, "content": mood + prompt}
		];

		const completion = await this.api.send(messages);
		if (completion.ok) {
			result = { result: completion.data };
		} else {
			result = { result: 'An error occurred during your request.'}
		}
		return result;

	}

	private async registerAnalytics(promptText: string, response: string, message: Message) {

		console.info("- ", new Date().toTimeString(), "Updating memory after IA request...");

		let newAnalytics = this.analytic.getAnalyticsFromResponse(response);

		const hasAnalytics = await this.analytic
			.hasAnalytics(promptText, newAnalytics, response, this.mood, this.book);

		console.log("Has analytics?", hasAnalytics);

		if (!hasAnalytics) {

			console.log("Has analytics? No, need to reprompt!");
			const requested = { keys: "" };
			const success = await this.analytic
				.requeryAnalyticKeys(requested, response);
			if (!success) {
				console.warn("- ", new Date().toTimeString(), "No analytics_mark found. ");

				BM.getInstance().add(this.book, {
					who: this.mood,
					timestamp: new Date(),
					prompt: promptText,
					keys: "",
					mem: BM.getMemAsString(),
					content: response
				});
				return;
			} else {
				message.reply("```json \n" + JSON.stringify(requested.keys, null, "\t") + "\n```");
			}
			newAnalytics = requested.keys;
		};

		console.log("Has analytics? Yes, process and store!");
		this.analytic.processAnalytics(promptText, newAnalytics, response, this.mood, this.book);
	}

	private async doSetMemory(message: Message, key: number) {

		console.log("**Requesting de memory for**", key);
		const row = await this.lite.getById(this.book, key);
		console.log("Memory found", row);
		let reply = "";
		if (row)  {
			console.log("Memory found for role:", row.who);
			this.mood = row.who;
			let foundMemory = false;
			if (row.keys) {
				foundMemory = BM.setMemoryFromStringifiedKeys(row.keys, key);
				if (!foundMemory) {
					reply = userLabels.CANT_ACCESS_MEMORY + key + row.keys;
				}
			} else { console.log("No keys found for", key) }

			if (!foundMemory && row.mem) {
				foundMemory = BM.setMemoryFromStringifiedKeys(row.mem, key);
				if (!foundMemory) {
					reply = userLabels.CANT_ACCESS_MEMORY + key + row.mem;
				}
			}  else { console.log("Already has keys or no mem found for", key) }

			if (!foundMemory) {
				console.warn("No memory found for", key);
				reply = userLabels.EMPTY_MEMORY + key;
			} else {
				this.getMemory(message);
				return
			}

		} else {
			console.warn("No memory found for", key);
			reply = userLabels.MEMORY_NOT_FOUND + key;
		}
		message.reply(reply);
	}

	/**
	 * Given a id number, retrieves the exported .md file that matches it.
	 *
	 * If not matches any, prints a menu of options.
	 */
	private async replyPageCommand(message: Message, key: number) {

		if (key) {

			const row = await this.lite.getById(this.book, key);
			if (row)  {

				console.log("getById Resolved!", key);

				const pathToFile = this.book.getExportFilenameFullPath(row);

				let hasFile = existsSync(pathToFile);
				if (!hasFile) {
					hasFile = this.book.exportRow(row);
				}

				if (hasFile) {
					console.log("Sending exported file for", pathToFile);
					message.channel
						.send(new MessageAttachment(pathToFile, this.book.rowAsExportFileName(row)))
						.catch(console.error);
					return;
				} else{
					console.warn("No file could be created for", key);
					return;
				}
			}
		}

		const rows: Entry[] = await this.lite.getAll(this.book);
		const list = await this.book.getBookEntriesAsMenuOption(rows);

		message.reply(this.getMenuList(userLabels.BOOK_ENTRIES_INDEX, list));

	}

	/**
	 * Given a book title, loads the book and opens it for query.
	 *
	 * If not matches any, creates the book
	 */
	private async replyBookCommand(message: Message, key: string) {

		const book = new Book(key);
		if (book.fsError) {
			const l = userLabels.BOOK_NAME_INVALID + key + "\n";

			message.reply(
				this.getMenuList(
					userLabels.BOOK_ENTRIES_INDEX,
					Book.getBooksList()
				)
			);
			return;
		}

		this.book = book;
		BM.setEmpty();
		message.reply(userLabels.BOOK_SELECTED + key);

		message.content = "amabot mem";
		this.lookUpOrSetMemory(message);

	}

	private getMenuList(subtitle: string, list: string) {

		return  "\n **" + userLabels.MEMORY_MENU + "** \n" +
			subtitle.replace("%book", this.book.title) +
			userLabels.OPTIONS_MENU +
			list.substring(0, 1700)
	}

}

