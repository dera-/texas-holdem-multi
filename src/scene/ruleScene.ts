import * as tool from "@akc29/akashictool4multi";
import { Label } from "@akashic-extension/akashic-label";
import { AiPlayerModelParameterObject } from "../model/aiPlayerModel";
import { AssetIds } from "../type/assetIds";
import { BaseScene, basicFont } from "./baseScene";
import { GameScene } from "./gameScene";

export interface RuleScenePrameterObject extends g.SceneParameterObject {

}

// CPU戦用待機画面
// TODO: 実態と大分異なるシーン名なので要修正
export class RuleScene extends BaseScene {
	private entry: tool.AkashicEntry;

	constructor(param: RuleScenePrameterObject) {
		super(param);
	}

	protected initialize(_param: RuleScenePrameterObject) {
		// CPU戦のためプレイヤーは1人しかいないので参加者の決定までやってしまう
		this.entry = new tool.AkashicEntry({ scene: this });
		this.entry.enter({
			id: g.game.selfId,
			name: "プレイヤー"
		});
		this.entry.decideName(g.game.selfId);
		// 以下のコードを実行するとなぜかserveでサーバー側も動作してエラーを起こすのでコメントアウトしておく
		// このため、現在CPU戦ではユーザー名が取れない状態になっている
		// this.entry.decidePlayableMembers();
	}

	protected handlerToLoad(): void {
		// TODO: ここでルール表示
		const backRect = new g.FilledRect({
			scene: this,
			cssColor: "#0b2a1f",
			width: g.game.width,
			height: g.game.height
		});
		this.append(backRect);
		const titleLabel = new Label({
			scene: this,
			text: "CPUとのテキサスホールデム(リングゲーム)を開始します\nプレイヤー同士の対戦はニコ生ゲーム上で行えます",
			font: basicFont,
			fontSize: 32,
			textColor: "#f7f2e8",
			textAlign: "center",
			width: g.game.width,
			y: 0.1 * g.game.width,
			local: true
		});
		this.append(titleLabel);
		this.setTimeout(() => {
			const assetIds = (JSON.parse((g.game.assets["assetIdsConfig"] as g.TextAsset).data) as AssetIds).game;
			const structuresMap = JSON.parse(this.asset.getTextById("structuresConfig").data);
			const playableMembers = this.entry.getPlayableMembers();
			g.game.pushScene(new GameScene({
				game: g.game,
				assetIds,
				service: {
					mode: "ring",
					players: [
						{
							id: g.game.selfId,
							name: playableMembers ? playableMembers[0].name : "プレイヤー",
							stack: 10000, // 一旦固定
							seatNumber: 0
						},
						{
							id: g.game.selfId + "0",
							name: "コールくん",
							stack: 10000, // 一旦固定
							seatNumber: 1,
							aiType: "call"
						} as AiPlayerModelParameterObject,
						{
							id: g.game.selfId + "1",
							name: "レイズちゃん",
							stack: 10000, // 一旦固定
							seatNumber: 2,
							aiType: "min-raise"
						} as AiPlayerModelParameterObject,
						{
							id: g.game.selfId + "2",
							name: "ランダムさん",
							stack: 10000, // 一旦固定
							seatNumber: 3,
							aiType: "random"
						} as AiPlayerModelParameterObject
					],
					structure: {
						structures: structuresMap["ring-short"],
						currentIndex: 0
					}
				}
			}));
		}, 3000);
	}
}
