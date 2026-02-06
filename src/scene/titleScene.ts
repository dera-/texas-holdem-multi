import { Label } from "@akashic-extension/akashic-label";
import { BaseScene, basicFont } from "./baseScene";
import { RecruitmentScene } from "./recruitmentScene";
import { RuleScene } from "./ruleScene";

export interface TitleScenePrameterObject extends g.SceneParameterObject {
	isCpuMode: boolean;
}

export class TitleScene extends BaseScene {
	private isCpuMode: boolean;
	constructor(param: TitleScenePrameterObject) {
		super(param);
	}

	protected initialize(param: TitleScenePrameterObject) {
		this.isCpuMode = param.isCpuMode;
	}

	protected handlerToLoad(): void {
		const backRect = new g.FilledRect({
			scene: this,
			cssColor: "#0b2a1f",
			width: g.game.width,
			height: g.game.height
		});
		this.append(backRect);
		const band = new g.FilledRect({
			scene: this,
			cssColor: "#f5d76e",
			width: 1.2 * g.game.width,
			height: 0.18 * g.game.height,
			x: -0.1 * g.game.width,
			y: 0.22 * g.game.height,
			opacity: 0.12,
			angle: -8
		});
		this.append(band);
		const chipAsset = this.asset.getImageById("chip");
		const chipLeft = new g.Sprite({
			scene: this,
			src: chipAsset,
			width: 120,
			height: 120,
			x: 0.05 * g.game.width,
			y: 0.65 * g.game.height,
			opacity: 0.6,
			angle: -18
		});
		const chipRight = new g.Sprite({
			scene: this,
			src: chipAsset,
			width: 90,
			height: 90,
			x: 0.85 * g.game.width,
			y: 0.12 * g.game.height,
			opacity: 0.5,
			angle: 24
		});
		this.append(chipLeft);
		this.append(chipRight);
		const titleShadowLabel = new Label({
			scene: this,
			text: "テキサスホールデムポーカー",
			font: basicFont,
			fontSize: 52,
			textColor: "black",
			textAlign: "center",
			width: g.game.width,
			x: 4,
			y: 0.1 * g.game.height + 4,
			opacity: 0.5,
			local: true
		});
		this.append(titleShadowLabel);
		const titleLabel = new Label({
			scene: this,
			text: "テキサスホールデムポーカー",
			font: basicFont,
			fontSize: 52,
			textColor: "#f5d76e",
			textAlign: "center",
			width: g.game.width,
			y: 0.1 * g.game.height,
			local: true
		});
		this.append(titleLabel);
		const subLabel = new Label({
			scene: this,
			text: "豪華な勝負が、いま始まる",
			font: basicFont,
			fontSize: 24,
			textColor: "#e7e0cf",
			textAlign: "center",
			width: g.game.width,
			y: 0.22 * g.game.height,
			local: true
		});
		this.append(subLabel);
		const hintLabel = new Label({
			scene: this,
			text: "まもなく募集画面へ移動します",
			font: basicFont,
			fontSize: 20,
			textColor: "#c9c0ab",
			textAlign: "center",
			width: g.game.width,
			y: 0.82 * g.game.height,
			local: true
		});
		this.append(hintLabel);
		this.onStateChange.add(state => {
			if (state === "active") {
				this.moveRecruitmentScene();
			}
		});
		this.moveRecruitmentScene();
	}

	private moveRecruitmentScene(time = 3000) {
		// なんか時間経過もしくはクリックで次のシーンに移るイベントを書いておく
		this.setTimeout(() => {
			// ここでの一人プレー用画面への遷移は禁止
			// if (this.isCpuMode) {
			// 	g.game.pushScene(new RuleScene({ game: g.game, assetIds: ["structuresConfig"] }));
			// } else {
				g.game.pushScene(new RecruitmentScene({ game: g.game, assetIds: ["structuresConfig", "chip"] }));
			// }
		}, time);
	}
}
