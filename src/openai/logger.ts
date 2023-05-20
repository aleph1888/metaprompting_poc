export class LG {

    static TaskStart(label: string, ...args: any[]) {

        console.log("***** TASK START", label," *****");
        console.log(...args)
        console.log("***** ---------- *****");

    }

    static Log(...args: any[]) {
        console.log(...args)
    }

}