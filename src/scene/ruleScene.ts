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
	private joinStatusLabel: Label;
	private joinCountLabel: Label;

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
		this.joinStatusLabel = new Label({
			scene: this,
			text: "",
			font: basicFont,
			fontSize: 24,
			textColor: "#e5e1d6",
			textAlign: "center",
			width: g.game.width,
			y: 0.38 * g.game.height,
			local: true
		});
		this.append(this.joinStatusLabel);
		this.joinCountLabel = new Label({
			scene: this,
			text: "",
			font: basicFont,
			fontSize: 24,
			textColor: "#e5e1d6",
			textAlign: "center",
			width: g.game.width,
			y: 0.44 * g.game.height,
			local: true
		});
		this.append(this.joinCountLabel);
		this.updateJoinInfo();
		this.onUpdate.add(this.updateJoinInfo, this);

		const startButton = new g.FilledRect({
			scene: this,
			cssColor: "#b38c2d",
			x: 0.35 * g.game.width,
			y: 0.6 * g.game.height,
			width: 0.3 * g.game.width,
			height: 0.1 * g.game.height,
			opacity: 0.95,
			local: true,
			touchable: true
		});
		const startLabel = new Label({
			scene: this,
			text: "CPU対戦開始",
			font: basicFont,
			fontSize: 26,
			textColor: "#2b1d06",
			textAlign: "center",
			width: startButton.width,
			y: 0.2 * startButton.height,
			local: true
		});
		startButton.append(startLabel);
		this.attachButtonFeedback(startButton);
		startButton.onPointUp.add(() => {
			this.startCpuGame();
		});
		this.append(startButton);

		const backButton = new g.FilledRect({
			scene: this,
			cssColor: "#1b4b32",
			x: 0.05 * g.game.width,
			y: 0.82 * g.game.height,
			width: 0.2 * g.game.width,
			height: 0.08 * g.game.height,
			opacity: 0.95,
			local: true,
			touchable: true
		});
		const backLabel = new Label({
			scene: this,
			text: "戻る",
			font: basicFont,
			fontSize: 22,
			textColor: "#f7f2e8",
			textAlign: "center",
			width: backButton.width,
			y: 0.2 * backButton.height,
			local: true
		});
		backButton.append(backLabel);
		this.attachButtonFeedback(backButton);
		backButton.onPointUp.add(() => {
			g.game.popScene();
		});
		this.append(backButton);
	}

	private updateJoinInfo(): void {
		const joined = true;
		const count = Math.max(1, g.game.joinedPlayerIds.length);
		const nextStatus = joined ? "参加予約: あり" : "参加予約: なし";
		if (this.joinStatusLabel.text !== nextStatus) {
			this.joinStatusLabel.text = nextStatus;
			this.joinStatusLabel.invalidate();
		}
		const nextCount = `参加人数: ${count}人`;
		if (this.joinCountLabel.text !== nextCount) {
			this.joinCountLabel.text = nextCount;
			this.joinCountLabel.invalidate();
		}
	}

	private startCpuGame(): void {
		const assetIds = (JSON.parse((g.game.assets["assetIdsConfig"] as g.TextAsset).data) as AssetIds).game;
		const structuresMap = JSON.parse(this.asset.getTextById("structuresConfig").data);
		const playableMembers = this.entry.getPlayableMembers();
		g.game.pushScene(new GameScene({
			game: g.game,
			assetIds,
			isCpuMode: true,
			cpuReserved: true,
			service: {
				mode: "ring",
				random: g.game.localRandom,
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
	}
}
