import { EventName } from ".";

export class LanguageChangeEvent extends Event {
    constructor(language: string) {
        super(EventName.LanguageChange);
        this.language = language;
    }
    language: string;
}

// Dispatch the custom event when the language changes
export function fireLanguageChangeEvent(newLanguage: string) {
    const event = new LanguageChangeEvent(newLanguage);
    window.dispatchEvent(event);
}
