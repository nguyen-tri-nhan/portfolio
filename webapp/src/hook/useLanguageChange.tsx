import { useEffect } from "react";
import { EventName } from "../app/event";

export const useLanguageChangeEffect = (callback: () => void) => {
  useEffect(() => {
    const onLanguageChange = () => {
      callback();
    }
    window.addEventListener(EventName.LanguageChange, onLanguageChange);
    return () => {
      window.removeEventListener(EventName.LanguageChange, onLanguageChange);
    };
  }, [callback]);
};
