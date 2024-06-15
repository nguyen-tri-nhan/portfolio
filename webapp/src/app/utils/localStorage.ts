export const LocalStorageKey = {
  language: "language",
};

const getLocalStorage = (key: string): string | null => {
  return localStorage.getItem(key);
};

const setLocalStorage = (key: string, value: string): void => {
  localStorage.setItem(key, value);
};

export const getLanguage = (): string => {
  return getLocalStorage(LocalStorageKey.language) ?? "en";
}

export const setLanguage = (language: string): void => {
  setLocalStorage(LocalStorageKey.language, language);
}