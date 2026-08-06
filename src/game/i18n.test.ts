import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSISTIVE_TEXT_LANGS, convertText, t } from "./i18n";
import { getSnapshot, patchSnapshot, startNewGame } from "./store";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("assistive text localization (opencc cn→hk)", () => {
  it("returns the source verbatim under zh-CN", () => {
    expect(convertText("白鸽巢 · 旧城街市", "zh-CN")).toBe("白鸽巢 · 旧城街市");
    expect(convertText("視障助乘巴士報站", "zh-CN")).toBe("視障助乘巴士報站");
  });

  it("converts 简体 to 港澳繁体 under zh-HK", () => {
    expect(convertText("澳门", "zh-HK")).toBe("澳門");
    expect(convertText("白鸽巢", "zh-HK")).toBe("白鴿巢");
    expect(convertText("关闸 · 17路候车区", "zh-HK")).toBe("關閘 · 17路候車區");
    expect(convertText("视障助乘巴士报站", "zh-HK")).toBe("視障助乘巴士報站");
    expect(convertText("便利店门口", "zh-HK")).toBe("便利店門口");
  });

  it("keeps Macau usage 台 instead of Taiwan 臺", () => {
    expect(convertText("台阶", "zh-HK")).toBe("台階");
    expect(convertText("一条小径上", "zh-HK")).not.toContain("一條小徑上臺");
  });

  it("converts a full HUD / tactile line consistently", () => {
    const line = "最近触觉：尚未触碰到物体。沿四纹盲道前往17路车门。赴约：在大三巴与老友林伯会合";
    expect(convertText(line, "zh-HK")).toBe("最近觸覺：尚未觸碰到物體。沿四紋盲道前往17路車門。赴約：在大三巴與老友林伯會合");
  });

  it("converts tutorial copy", () => {
    expect(convertText("四条凸纹表示继续前进", "zh-HK")).toBe("四條凸紋表示繼續前進");
  });
});

describe("t() follows the current assistiveTextLang setting", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    startNewGame();
  });

  it("converts under zh-HK and returns source under zh-CN", () => {
    patchSnapshot({ settings: { ...getSnapshot().settings, assistiveTextLang: "zh-HK" } });
    expect(t("白鸽巢")).toBe("白鴿巢");
    patchSnapshot({ settings: { ...getSnapshot().settings, assistiveTextLang: "zh-CN" } });
    expect(t("白鸽巢")).toBe("白鸽巢");
  });

  it("exposes the two language options in display order", () => {
    expect(ASSISTIVE_TEXT_LANGS.map((lang) => lang.id)).toEqual(["zh-CN", "zh-HK"]);
    expect(ASSISTIVE_TEXT_LANGS.map((lang) => lang.label)).toEqual(["简体中文", "繁體中文"]);
  });
});
