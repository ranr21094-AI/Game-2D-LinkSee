import type { EndingChoice, KnownLandmarkId, OpeningReply } from "./types";

export const JOURNEY_GOAL = "赴约：在大三巴与老友林伯会合";

export const OPENING_REPLIES: ReadonlyArray<{ id: OpeningReply; label: string; echo: string }> = [
  { id: "old-place", label: "我会到，老地方见。", echo: "你答应过会到老地方。林伯一直记得。" },
  { id: "careful", label: "雨后路滑，我会慢一点。", echo: "林伯先问你路上是否湿滑。你笑着说，慢一点也到了。" },
  { id: "call-nearby", label: "到附近我再联系你。", echo: "你还没来得及再联系，林伯已经从脚步声里认出了你。" },
] as const;

export const ENDING_CHOICES: ReadonlyArray<{ id: EndingChoice; label: string }> = [
  { id: "photo", label: "一起重拍旧照片" },
  { id: "listen-rain", label: "先听一会儿牌坊前的雨声" },
  { id: "share-memories", label: "把一路想起的往事讲给林伯听" },
] as const;

export const LANDMARK_NOTES: Record<KnownLandmarkId, string> = {
  "gate-rain": "关闸站棚：雨点落在金属顶棚，声音清脆而集中。",
  "route-17-engine": "17路候车区：巴士引擎声在站牌前方，凸字站牌靠近车门。",
  "bus-card-reader": "17路车厢：刷卡机在上车后的右前方，会发出短促电子音。",
  "bus-seat": "17路车厢：空座由软垫和金属座架共同确认。",
  "bus-bell": "17路车厢：下车铃在座位附近，报站后可以用盲杖确认。",
  "harbor-horn": "行车途中：内港汽笛意味着车辆正在接近旧城区。",
  "old-city-crossing": "旧城路口：路缘点阵与连续双音共同确认通行时机。",
  "flower-bell": "商铺街：花纸轻响和饼家风铃能帮助辨认店墙一侧。",
  "egg-tart-oven": "葡挞摊：烤炉计时铃和酥皮香来自盲道旁的摊车。",
  "pet-shop-bell": "猫记宠物：门铃在北向盲道右侧。",
  "ruins-wheelchair": "大三巴坡道：轮椅轻响来自中央坡道入口。",
  "ruins-rain": "大三巴牌坊：雨水沿石墙和坡道护栏落下。",
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
