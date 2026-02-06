import { Label } from "@akashic-extension/akashic-label";
import { PlayerResultModel } from "../model/playerResultModel";
import { GameMode, getGameModeName } from "../type/gameMode";
import { BaseScene, basicFont } from "./baseScene";

export interface ResultScenePrameterObject extends g.SceneParameterObject {
	playerResults: PlayerResultModel[];
	gameMode: GameMode
}

export class ResultScene extends BaseScene {
	private playerResults: PlayerResultModel[];
	private gameMode: GameMode;
	private buttonAssetConfig: g.ImageAssetConfigurationBase;

	constructor(param: ResultScenePrameterObject) {
		super(param);
	}

	protected initialize(param: ResultScenePrameterObject) {
		this.playerResults = param.playerResults.sort((a, b) => a.place - b.place);
		this.gameMode = param.gameMode;
		this.buttonAssetConfig = g.game._configuration.assets["button"] as g.ImageAssetConfigurationBase;
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
			cssColor: "#d4af37",
			width: 1.2 * g.game.width,
			height: 0.14 * g.game.height,
			x: -0.1 * g.game.width,
			y: 0.08 * g.game.height,
			opacity: 0.12,
			angle: -8
		});
		this.append(band);
		// result画面のタイトル
		const gameTitleShadowLabel = new Label({
			scene: this,
			text: `${getGameModeName(this.gameMode)}結果`,
			font: basicFont,
			fontSize: 44, // あくまで目安。あとで変えるかも
			textColor: "black",
			textAlign: "center",
			width: 0.9 * g.game.width,
			x: 0.05 * g.game.width + 3,
			y: 0.05 * g.game.width + 3,
			opacity: 0.5
		});
		this.append(gameTitleShadowLabel);
		const gameTitleLabel = new Label({
			scene: this,
			text: `${getGameModeName(this.gameMode)}結果`,
			font: basicFont,
			fontSize: 44, // あくまで目安。あとで変えるかも
			textColor: "#f5d76e",
			textAlign: "center",
			width: 0.9 * g.game.width,
			x: 0.05 * g.game.width,
			y: 0.05 * g.game.width
		});
		this.append(gameTitleLabel);
		// 各プレイヤーの結果表示
		for (let i = 0; i < this.playerResults.length; i++) {
			const result = this.playerResults[i];
			const place = result.place > 3 ? `${result.place}th` :
				result.place === 3 ? "3rd" :
				result.place === 2 ? "2nd" :
				"1st";
			const resultStr = `${place} ${result.player.getName()} チップ数：${result.stack || 0}`;
			const playerLabel = new Label({
				scene: this,
				text: resultStr,
				font: basicFont,
				fontSize: 24, // あくまで目安。あとで変えるかも
				textColor: "#f7f2e8",
				textAlign: "center",
				width: 0.6 * g.game.width,
				x: 0.2 * g.game.width,
				y: (0.2 + i * 0.07) * g.game.height
			});
			this.append(playerLabel);
		}
		// タイトルへ戻るボタン
		const returnButtonSprite = new g.Sprite({
			scene: this,
			src: this.asset.getImageById("button"),
			touchable: true,
			srcWidth: this.buttonAssetConfig.width,
			srcHeight: this.buttonAssetConfig.height,
			width: 0.3 * g.game.width,
			height: 0.1 * g.game.height,
			x: 0.35 * g.game.width,
			y: (0.24 + this.playerResults.length * 0.07) * g.game.height
		});
		returnButtonSprite.onPointUp.add((ev) => {
			// joinedPlayerが不在でこのシーンまで来たらCPU戦という想定でこの条件式にしているが問題があったら修正する
			if (g.game.joinedPlayerIds.length === 0 || g.game.joinedPlayerIds.indexOf(ev.player.id) !== -1) {
				g.game.popScene(false, 3); // ゲームシーン、募集シーン、タイトルシーンという感じで並んでいるのでタイトルまでは3つ戻る
			}
		});
		const returnButtonLabel = new Label({
			scene: this,
			text: g.game.joinedPlayerIds.length === 0 ? "タイトルへ戻る" : "タイトルへ戻る\n(配信者のみ選択可能)",
			font: basicFont,
			fontSize: 28, // あくまで目安。あとで変えるかも
			textColor: "white",
			textAlign: "center",
			width: 0.3 * g.game.width
		});
		returnButtonSprite.append(returnButtonLabel);
		this.attachButtonFeedback(returnButtonSprite, {
			onPress: () => {
				returnButtonLabel.textColor = "#f5d76e";
				returnButtonLabel.invalidate();
			},
			onRelease: () => {
				returnButtonLabel.textColor = "white";
				returnButtonLabel.invalidate();
			}
		});
		this.append(returnButtonSprite);
	}
}
