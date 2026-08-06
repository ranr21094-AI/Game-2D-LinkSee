import type { EndingChoice, MemoryId, OpeningReply } from "./types";

export const JOURNEY_GOAL = "赴约：在大三巴与老友林伯会合";

export const OPENING_REPLIES: ReadonlyArray<{ id: OpeningReply; label: string; echo: string }> = [
  { id: "old-place", label: "我会到，老地方见。", echo: "你答应过会到老地方。林伯一直记得。" },
] as const;

export const ENDING_CHOICES: ReadonlyArray<{ id: EndingChoice; label: string }> = [
  { id: "photo", label: "一起重拍旧照片" },
  { id: "listen-rain", label: "先听一会儿牌坊前的雨声" },
  { id: "share-memories", label: "把一路想起的往事讲给林伯听" },
] as const;

export const MEMORY_DEFINITIONS: Record<MemoryId, { title: string; description: string }> = {
  "old-city-bell": { title: "旧城风铃", description: "商铺短巷尽头，饼家的风铃在雨里轻轻响。林伯说，会走错路也算澳门的一部分。" },
  "egg-tart": { title: "暖掌葡挞", description: "刚出炉的蛋挞暖在掌心，酥皮和甜香在雨夜格外清晰。" },
  "ruins-rain": { title: "牌坊雨声", description: "大三巴牌坊下的雨声，和语音里林伯说的那个老地方连在一起。" },
};

export function openingReplyEcho(reply: OpeningReply | null): string {
  return OPENING_REPLIES.find((item) => item.id === reply)?.echo ?? "林伯笑着说：我就知道，你会来。";
}

export function endingChoiceCopy(choice: EndingChoice | null, memoryCount: number): { action: string; quote: string } {
  if (choice === "listen-rain") {
    return { action: "你和林伯没有急着拍照，只在牌坊前听了一会儿雨。", quote: "“老地方的雨声，还是和从前一样。”" };
  }
  if (choice === "share-memories") {
    return {
      action: memoryCount >= 3 ? "你把一路亮起的三段往事完整讲给林伯听。" : "你把一路想起的声音和触感慢慢讲给林伯听。",
      quote: "“路上的故事，也应该留在照片里。”",
    };
  }
  return { action: "林伯举起相机，你们在同一个位置重拍了那张旧照片。", quote: "“这一次，我们都没有错过约定。”" };
}
