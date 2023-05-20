import { Configuration, OpenAIApi } from "openai";
const auth = require('../../package.json');
const path = require("path");

const MAX_TOKENS = 750;
export interface ApiReply {
	ok:	 boolean;
	data: string;
}

export const IA_MODEL = "gpt-3.5-turbo";
export const IA_PARAMS = {
	model: IA_MODEL,

	temperature: 0.7,
	max_tokens: MAX_TOKENS,
	top_p: 1,
	presence_penalty: 0.6,
	frequency_penalty: 0.0,
	n: 1,
}
const configuration = new Configuration({
	apiKey: auth.openai.key
});

export class Api {
	openai: OpenAIApi;

  	constructor() {
		this.openai = new OpenAIApi(configuration);
  	}

	async send (messages: any[]): Promise<ApiReply> {
		try {

			console.log("Prompting", messages);
			const completion = await this.openai.createChatCompletion({
				...IA_PARAMS,
				messages
			});
			const data = completion.data.choices[0].message.content;
			return {
				ok: true,
				data
			};

		} catch(error) {

			// Consider adjusting the error handling logic for your use case
			if (error.response) {
				console.error(error.response.status, error.response.data);
				return { ok: false, data: error.response.data.error.message }
			} else {
				console.error(`Error with OpenAI API request: ${error.message}`);
				return { ok: false, data: 'An error occurred during your request.' }
			}

		}
	}
}

