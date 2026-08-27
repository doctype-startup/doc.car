"use client";

const HISTORY_KEY = "doccar_history";
const MAX_ITEMS = 20;

export type HistoryItem = {
  placa: string;
  consultadoEm: string;
};

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addHistory(placa: string) {
  const items = getHistory().filter((item) => item.placa !== placa);
  items.unshift({ placa, consultadoEm: new Date().toLocaleString("pt-BR") });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}
