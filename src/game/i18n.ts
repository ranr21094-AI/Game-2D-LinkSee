import * as opencc from "opencc-js";
import { getSnapshot } from "./store";
import type { AssistiveTextLang } from "./types";

export type { AssistiveTextLang };

/**
 * 辅助文字国际化。
 * 源码文案统一为简体中文；选择「繁體中文（港澳）」时，在显示 / 朗读出口用 opencc 的 cn→hk 转换。
 * cn→hk 保留澳门/香港用字习惯（台階、平台、軟件、網絡），与 zh-HK 粤语语音一致。
 */
const toTraditional = opencc.Converter({ from: "cn", to: "hk" });

/** 按指定语言转换；zh-CN 原样返回，zh-HK 转写为港澳繁体。 */
export function convertText(text: string, lang: AssistiveTextLang): string {
  return lang === "zh-HK" ? toTraditional(text) : text;
}

/** 按当前设置转换文案；React 渲染与 TTS 朗读统一经此出口。 */
export function t(text: string): string {
  return convertText(text, getSnapshot().settings.assistiveTextLang);
}

/** 语言选项（设置面板 / 标题页展示顺序）。 */
export const ASSISTIVE_TEXT_LANGS: ReadonlyArray<{ id: AssistiveTextLang; label: string }> = [
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-HK", label: "繁體中文" },
];
