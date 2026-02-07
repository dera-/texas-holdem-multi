import * as tool from "@akc29/akashictool4multi";
import { Label } from "@akashic-extension/akashic-label";
import { PlayerModelParameterObject } from "../model/playerModel";
import { AssetIds } from "../type/assetIds";
import { BaseScene, basicFont } from "./baseScene";
import { GameScene } from "./gameScene";
import { AiPlayerModelParameterObject } from "../model/aiPlayerModel";
import { GameMode, GameTerm } from "../type/gameMode";
import { StructureData } from "../model/structureModel";

export interface RecruitmentScenePrameterObject extends g.SceneParameterObject {}

export interface SelectorItem {
	name: string,
	value: any;
}

const MAX_PLAYER_COUNT = 8; // 試しにMAX8名としておく
const MIN_PLAYER_COUNT = 2;
const GAME_MODE_KEY: string = "mode";
const GAME_TERM_KEY: string = "term";
const gameModeSelectorItems: SelectorItem[] = [
	{ name: "リングゲーム", value: "ring"},
	{ name: "トーナメント", value: "tornament"}
];
const gameTermSelectorItems: SelectorItem[] = [
	{ name: "短め", value: "short"},
	{ name: "普通", value: "middle"},
	{ name: "長め", value: "long"}
];
const COLOR_BG = "#0b2a1f";
const COLOR_PANEL = "#103625";
const COLOR_PANEL_SHADOW = "#071a13";
const COLOR_TEXT = "#f7f2e8";
const COLOR_GOLD = "#d4af37";
const COLOR_GOLD_DARK = "#b38c2d";
const COLOR_BUTTON = "#1b4b32";
const COLOR_BUTTON_ACTIVE = "#d4af37";
export class RecruitmentScene extends BaseScene {
	private entry: tool.AkashicEntry;
	private gameMode: GameMode;
	private gameTerm: GameTerm;
	private countdownEntity: g.E | null = null;
	private countdownLabel: Label | null = null;
	private countdownRemaining: number = 0;
	private countdownTimerId: g.TimerIdentifier | null = null;
	private countdownRunning: boolean = false;
	private countdownFinished: boolean = false;
	private countdownStartAt: number | null = null;
	private pendingMembers: tool.PlayerInfo[] | null = null;

	constructor(param: RecruitmentScenePrameterObject) {
		super(param);
	}

	protected initialize(_param: RecruitmentScenePrameterObject) {
		this.entry = new tool.AkashicEntry({
			scene: this,
			playableLimit: MAX_PLAYER_COUNT,
			startableCount: MIN_PLAYER_COUNT,
			premiumuRate: 3,
			callbackAfterDicision: (members: tool.PlayerInfo[]) => {
				if (!this.countdownFinished) {
					this.pendingMembers = members;
					if (!this.countdownRunning) {
						if (this.countdownStartAt == null) {
							this.countdownStartAt = g.game.age;
						}
						const passed = Math.max(0, Math.floor((g.game.age - this.countdownStartAt) / g.game.fps));
						const remaining = Math.max(1, 5 - passed);
						this.startCountdown(remaining);
					}
					return;
				}
				this.startGameWithMembers(members);
			}
		});
	}

	protected handlerToLoad(): void {
		const backRect = new g.FilledRect({
			scene: this,
			cssColor: COLOR_BG,
			width: g.game.width,
			height: g.game.height
		});
		this.append(backRect);
		const band = new g.FilledRect({
			scene: this,
			cssColor: COLOR_GOLD,
			width: 1.2 * g.game.width,
			height: 0.16 * g.game.height,
			x: -0.1 * g.game.width,
			y: 0.12 * g.game.height,
			opacity: 0.12,
			angle: -8
		});
		this.append(band);
		const chipAsset = this.asset.getImageById("chip");
		const chipLeft = new g.Sprite({
			scene: this,
			src: chipAsset,
			width: 90,
			height: 90,
			x: 0.04 * g.game.width,
			y: 0.78 * g.game.height,
			opacity: 0.55,
			angle: -14
		});
		const chipRight = new g.Sprite({
			scene: this,
			src: chipAsset,
			width: 70,
			height: 70,
			x: 0.88 * g.game.width,
			y: 0.08 * g.game.height,
			opacity: 0.5,
			angle: 22
		});
		this.append(chipLeft);
		this.append(chipRight);
		const contributerEntity = this.createContributerPane();
		const audienceEntity = this.createAudiencePane();
		let isJoined: boolean = false;
		this.append(audienceEntity);
		this.onMessage.add(this.handleMessage, this);
		const forced = (g.game.vars as any).forceCountdown;
		if (forced && !this.countdownRunning) {
			this.handleMessage(new g.MessageEvent(forced));
			(g.game.vars as any).forceCountdown = null;
		}
		this.onUpdate.add(() => {
			if (g.game.joinedPlayerIds.indexOf(g.game.selfId) !== -1) {
				if (!isJoined) {
					isJoined = true;
					this.remove(audienceEntity);
					this.append(contributerEntity);
					this.entry.enter({
						id: g.game.selfId,
						name: "配信者" + Math.floor(1000 * g.game.localRandom.generate())
					}, true);
				}
			} else {
				if (isJoined) {
					isJoined = false;
					this.remove(contributerEntity);
					this.append(audienceEntity);
					this.entry.cancel(g.game.selfId);
				}
			}
		});
	}

	private createGameScene(members: tool.PlayerInfo[]): GameScene {
		const assetIds = (JSON.parse((g.game.assets["assetIdsConfig"] as g.TextAsset).data) as AssetIds).game;
		const players: PlayerModelParameterObject[] = [];
		for (let i = 0; i < members.length; i++) {
			const info = members[i];
			players.push({
				id: info.id,
				name: info.name,
				stack: 10000, // 一旦固定
				seatNumber: i
			});
		}
		const mode: GameMode = this.entry.getOptionValue(GAME_MODE_KEY) || "ring";
		const term: GameTerm = this.entry.getOptionValue(GAME_TERM_KEY) || "short";
		const key: string = `${mode}-${term}`;
		const structuresMap = (JSON.parse(this.asset.getTextById("structuresConfig").data) as {[key: string]: StructureData[]});
		return new GameScene({
			game: g.game,
			assetIds,
			service: {
				mode,
				players,
				structure: {
					structures: structuresMap[key],
					currentIndex: 0
				}
			}
		});
	}

	private createContributerPane(): g.E {
		const entity = new g.E({scene: this, width: g.game.width, height: g.game.height});
		entity.append(this.createPlayerInfoEntity({
			x: 0.05 * g.game.width,
			y: 0.1 * g.game.height,
			width: 0.9 * g.game.width,
			height: 0.45 * g.game.height
		}));
		entity.append(this.createSelectorEntity(
			{
				x: 0.05 * g.game.width,
				y: 0.525 * g.game.height,
				width: 0.9 * g.game.width,
				height: 0.1 * g.game.height
			},
			"ゲーム種別:",
			GAME_MODE_KEY,
			gameModeSelectorItems
		));
		entity.append(this.createSelectorEntity(
			{
				x: 0.05 * g.game.width,
				y: 0.65 * g.game.height,
				width: 0.9 * g.game.width,
				height: 0.1 * g.game.height
			},
			"ゲーム時間:",
			GAME_TERM_KEY,
			gameTermSelectorItems
		));
		const startButton = this.createButtonEntity({
			x: 0.4 * g.game.width,
			y: 0.8 * g.game.height,
			width: 0.2 * g.game.width,
			height: 0.1 * g.game.height,
			label: "ゲーム開始",
			fontSize: 24,
			baseColor: COLOR_GOLD_DARK,
			textColor: "#2b1d06"
		});
		startButton.entity.opacity = 0.85;
		startButton.entity.onPointUp.add(() => {
			// TODO: 参加希望2人未満ならボタンをdisableにする
			if (this.entry.getEnteredMenmberCount() >= 2 && !this.countdownRunning) {
				const payload = { message: "START_GAME_COUNTDOWN", startAt: g.game.age };
				g.game.raiseEvent(new g.MessageEvent(payload));
				this.handleMessage(new g.MessageEvent(payload));
			}
		});
		this.attachButtonFeedback(startButton.entity, {
			onPress: () => {
				startButton.shine.opacity = 0.4;
				startButton.shine.modified();
			},
			onRelease: () => {
				startButton.shine.opacity = 0.22;
				startButton.shine.modified();
			}
		});
		entity.append(startButton.entity);
		const cpuButton = this.createButtonEntity({
			x: 0.1 * g.game.width,
			y: 0.8 * g.game.height,
			width: 0.22 * g.game.width,
			height: 0.1 * g.game.height,
			label: "CPUと対戦",
			fontSize: 20,
			baseColor: COLOR_BUTTON,
			textColor: COLOR_TEXT
		});
		cpuButton.entity.onPointUp.add(() => {
			this.startCpuGame();
		});
		this.attachButtonFeedback(cpuButton.entity, {
			onPress: () => {
				cpuButton.shine.opacity = 0.35;
				cpuButton.shine.modified();
			},
			onRelease: () => {
				cpuButton.shine.opacity = 0.22;
				cpuButton.shine.modified();
			}
		});
		entity.append(cpuButton.entity);

		return entity;
	}

	private createAudiencePane(): g.E {
		const entity = new g.E({scene: this, width: g.game.width, height: g.game.height});
		entity.append(this.createPlayerInfoEntity({
			x: 0.05 * g.game.width,
			y: 0.1 * g.game.height,
			width: 0.9 * g.game.width,
			height: 0.45 * g.game.height
		}));
		const gameModeLabel = new Label({
			scene: this,
			text: "ゲーム種別: ",
			font: basicFont,
			fontSize: 32,
			textColor: COLOR_TEXT,
			textAlign: "left",
			width: 0.9 * g.game.width,
			x: 0.2 * g.game.width,
			y: 0.525 * g.game.height,
		});
		gameModeLabel.onUpdate.add(() => {
			const gameMode = this.entry.getOptionValue(GAME_MODE_KEY);
			if (gameMode && gameMode !== this.gameMode) {
				this.gameMode = gameMode;
				const targets = gameModeSelectorItems.filter(item => item.value === gameMode);
				if (targets.length > 0) {
					gameModeLabel.text = "ゲーム種別: " + targets[0].name;
					gameModeLabel.invalidate();
				}
			}
		});
		entity.append(gameModeLabel);
		const gameTermLabel = new Label({
			scene: this,
			text: "ゲーム時間: ",
			font: basicFont,
			fontSize: 32,
			textColor: COLOR_TEXT,
			textAlign: "left",
			width: 0.9 * g.game.width,
			x: 0.2 * g.game.width,
			y: 0.65 * g.game.height,
		});
		gameTermLabel.onUpdate.add(() => {
			const gameTerm = this.entry.getOptionValue(GAME_TERM_KEY);
			if (gameTerm && gameTerm !== this.gameTerm) {
				this.gameTerm = gameTerm;
				const targets = gameTermSelectorItems.filter(item => item.value === gameTerm);
				if (targets.length > 0) {
					gameTermLabel.text = "ゲーム時間: " + targets[0].name;
					gameTermLabel.invalidate();
				}
			}
		});
		entity.append(gameTermLabel);
		const entryButton = this.createButtonEntity({
			x: 0.25 * g.game.width,
			y: 0.8 * g.game.height,
			width: 0.2 * g.game.width,
			height: 0.1 * g.game.height,
			label: "ゲームに参加",
			fontSize: 20,
			baseColor: COLOR_BUTTON,
			textColor: COLOR_TEXT
		});
		entryButton.entity.onPointUp.add(() => {
			entryButton.rect.cssColor = COLOR_BUTTON_ACTIVE;
			entryButton.rect.modified();
			entryButton.label.textColor = "#2b1d06";
			entryButton.label.invalidate();
			this.entry.enter({
				id: g.game.selfId,
				name: "匿名" + Math.floor(1000 * g.game.localRandom.generate())
			}, true);
		});
		this.attachButtonFeedback(entryButton.entity, {
			onPress: () => {
				entryButton.shine.opacity = 0.35;
				entryButton.shine.modified();
			},
			onRelease: () => {
				entryButton.shine.opacity = 0.22;
				entryButton.shine.modified();
			}
		});
		entity.append(entryButton.entity);
		const cancelButton = this.createButtonEntity({
			x: 0.55 * g.game.width,
			y: 0.8 * g.game.height,
			width: 0.2 * g.game.width,
			height: 0.1 * g.game.height,
			label: "参加キャンセル",
			fontSize: 20,
			baseColor: COLOR_BUTTON,
			textColor: COLOR_TEXT
		});
		cancelButton.entity.onPointUp.add(() => {
			entryButton.rect.cssColor = COLOR_BUTTON;
			entryButton.rect.modified();
			entryButton.label.textColor = COLOR_TEXT;
			entryButton.label.invalidate();
			this.entry.cancel(g.game.selfId);
		});
		this.attachButtonFeedback(cancelButton.entity, {
			onPress: () => {
				cancelButton.shine.opacity = 0.35;
				cancelButton.shine.modified();
			},
			onRelease: () => {
				cancelButton.shine.opacity = 0.22;
				cancelButton.shine.modified();
			}
		});
		entity.append(cancelButton.entity);
		const cpuButton = this.createButtonEntity({
			x: 0.04 * g.game.width,
			y: 0.8 * g.game.height,
			width: 0.19 * g.game.width,
			height: 0.1 * g.game.height,
			label: "CPUと対戦",
			fontSize: 18,
			baseColor: COLOR_BUTTON,
			textColor: COLOR_TEXT
		});
		cpuButton.entity.onPointUp.add(() => {
			this.startCpuGame();
		});
		this.attachButtonFeedback(cpuButton.entity, {
			onPress: () => {
				cpuButton.shine.opacity = 0.35;
				cpuButton.shine.modified();
			},
			onRelease: () => {
				cpuButton.shine.opacity = 0.22;
				cpuButton.shine.modified();
			}
		});
		entity.append(cpuButton.entity);
	
		return entity;
	}

	private createPlayerInfoEntity(area: g.CommonArea): g.E {
		let entryCount = this.entry.getEnteredMenmberCount();
		const entity = new g.E({scene: this, width: area.width, height: area.height, x: area.x, y: area.y, local: true});
		const shadow = new g.FilledRect({
			scene: this,
			cssColor: COLOR_PANEL_SHADOW,
			width: area.width,
			height: area.height,
			x: 0,
			y: 6,
			opacity: 0.6
		});
		entity.append(shadow);
		const panel = new g.FilledRect({
			scene: this,
			cssColor: COLOR_PANEL,
			width: area.width,
			height: area.height,
			opacity: 0.92
		});
		entity.append(panel);
		const infoLabel = new Label({
			scene: this,
			text: `募集人数：${MAX_PLAYER_COUNT}人まで(${MIN_PLAYER_COUNT}人からプレー可)`,
			font: basicFont,
			fontSize: 36, // あくまで目安。あとで変えるかも
			textColor: COLOR_TEXT,
			textAlign: "center",
			width: 0.8 * area.width,
			x: 0.1 * area.width,
			y: 0
		});
		entity.append(infoLabel);
		const playerCountLabel = new Label({
			scene: this,
			text: `参加希望人数：${entryCount}人`,
			font: basicFont,
			fontSize: 32, // あくまで目安。あとで変えるかも
			textColor: COLOR_TEXT,
			textAlign: "center",
			width: 0.8 * area.width,
			x: 0.1 * area.width,
			y: 0.5 * area.height
		});
		playerCountLabel.onUpdate.add(() => {
			if (entryCount !== this.entry.getEnteredMenmberCount()) {
				entryCount = this.entry.getEnteredMenmberCount();
				playerCountLabel.text = `参加希望人数：${entryCount}人`;
				playerCountLabel.invalidate();
			}
		});
		entity.append(playerCountLabel);
		return entity;
	}

	private createSelectorEntity(area: g.CommonArea, title: string, selectorName: string, selectorItems: SelectorItem[], selected: number = 0): g.E {
		const entity = new g.E({scene: this, x: area.x, y: area.y, width: area.width, height: area.height});
		const shadow = new g.FilledRect({
			scene: this,
			cssColor: COLOR_PANEL_SHADOW,
			width: area.width,
			height: area.height,
			x: 0,
			y: 4,
			opacity: 0.6
		});
		entity.append(shadow);
		const panel = new g.FilledRect({
			scene: this,
			cssColor: COLOR_PANEL,
			width: area.width,
			height: area.height,
			opacity: 0.9
		});
		entity.append(panel);
		const titleLabel = new Label({
			scene: this,
			text: title,
			font: basicFont,
			fontSize: 32,
			textColor: COLOR_TEXT,
			textAlign: "left",
			width: 0.2 * area.width,
			height: area.height
		});
		entity.append(titleLabel);
		const buttonWidth = 0.18 * area.width;
		const buttonHeight = 0.3 * buttonWidth;
		const interval = 0.05 * area.width
		const itemButtons: {
			entity: g.E;
			rect: g.FilledRect;
			label: Label;
			shine: g.FilledRect;
		}[] = [];
		for (let i = 0; i < selectorItems.length; i++) {
			const itemButton = this.createButtonEntity({
				x: 0.2 * area.width + i * buttonWidth + (i + 1) * interval,
				y: (area.height - buttonHeight) / 2,
				width: buttonWidth,
				height: buttonHeight,
				label: selectorItems[i].name,
				fontSize: 20,
				baseColor: i === selected ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON,
				textColor: i === selected ? "#2b1d06" : COLOR_TEXT
			});
			itemButton.entity.opacity = 0.95;
			this.attachButtonFeedback(itemButton.entity, {
				onPress: () => {
					itemButton.shine.opacity = 0.35;
					itemButton.shine.modified();
				},
				onRelease: () => {
					itemButton.shine.opacity = 0.22;
					itemButton.shine.modified();
				}
			});
			itemButtons.push(itemButton);
		}
		// ボタン押した時のイベントで他のボタンに影響を及ぼすためfor文を分けている
		for (let i = 0; i < itemButtons.length; i++) {
			const button = itemButtons[i];
			button.entity.onPointUp.add(() => {
				itemButtons.forEach(b => {
					b.rect.cssColor = COLOR_BUTTON;
					b.rect.modified();
					b.label.textColor = COLOR_TEXT;
					b.label.invalidate();
				});
				button.rect.cssColor = COLOR_BUTTON_ACTIVE;
				button.rect.modified();
				button.label.textColor = "#2b1d06";
				button.label.invalidate();
				this.entry.setOptionData(selectorName, selectorItems[i].value);
			});
			entity.append(button.entity);
		}
		// とりあえず見た目との整合性のために選択されている選択肢は内部的にもセットしておく
		if (0 <= selected && selected < selectorItems.length) {
			this.entry.setOptionData(selectorName, selectorItems[selected].value);
		}
		return entity;
	}

	private handleMessage(ev: g.MessageEvent): void {
		if (!ev.data || !ev.data.message) {
			return;
		}
		if (ev.data.message === "START_GAME_COUNTDOWN") {
			if (this.countdownRunning) {
				return;
			}
			const startAt = typeof ev.data.startAt === "number" ? ev.data.startAt : g.game.age;
			if (this.countdownStartAt == null) {
				this.countdownStartAt = startAt;
			}
			const passed = Math.max(0, Math.floor((g.game.age - this.countdownStartAt) / g.game.fps));
			const remaining = Math.max(1, 5 - passed);
			this.startCountdown(remaining);
			if (g.game.joinedPlayerIds.indexOf(g.game.selfId) !== -1) {
				this.entry.decidePlayableMembers();
			}
		}
	}

	private startCountdown(seconds: number): void {
		this.countdownRunning = true;
		this.countdownFinished = false;
		this.countdownRemaining = seconds;
		if (!this.countdownEntity) {
			this.countdownEntity = new g.E({ scene: this, width: g.game.width, height: g.game.height, local: true });
			const mask = new g.FilledRect({
				scene: this,
				cssColor: "black",
				width: g.game.width,
				height: g.game.height,
				opacity: 0.45
			});
			this.countdownEntity.append(mask);
			this.countdownLabel = new Label({
				scene: this,
				text: "",
				font: basicFont,
				fontSize: 96,
				textColor: "#f5d76e",
				textAlign: "center",
				width: g.game.width,
				y: 0.38 * g.game.height,
				local: true
			});
			this.countdownEntity.append(this.countdownLabel);
		}
		this.updateCountdownLabel();
		this.append(this.countdownEntity);
		if (this.countdownTimerId) {
			this.clearInterval(this.countdownTimerId);
		}
		this.countdownTimerId = this.setInterval(() => {
			this.countdownRemaining -= 1;
			if (this.countdownRemaining <= 0) {
				this.finishCountdown();
				return;
			}
			this.updateCountdownLabel();
		}, 1000);
	}

	private updateCountdownLabel(): void {
		if (!this.countdownLabel) {
			return;
		}
		this.countdownLabel.text = `開始まで ${this.countdownRemaining}`;
		this.countdownLabel.invalidate();
	}

	private finishCountdown(): void {
		this.countdownFinished = true;
		this.countdownRunning = false;
		if (this.countdownTimerId) {
			this.clearInterval(this.countdownTimerId);
			this.countdownTimerId = null;
		}
		if (this.countdownEntity) {
			this.remove(this.countdownEntity);
		}
		if (this.pendingMembers) {
			this.startGameWithMembers(this.pendingMembers);
		}
	}

	private startGameWithMembers(members: tool.PlayerInfo[]): void {
		// とりあえずリングゲームを固定で作る感じで
		// TODO: 配信者側からリングかトナメか選べるようにする。その場合、ゲーム側でもトナメ(やリング)専用の処理を書く必要がある。
		this.countdownRunning = false;
		g.game.pushScene(this.createGameScene(members));
	}

	private startCpuGame(): void {
		const assetIds = (JSON.parse((g.game.assets["assetIdsConfig"] as g.TextAsset).data) as AssetIds).game;
		const structuresMap = JSON.parse(this.asset.getTextById("structuresConfig").data);
		const reserved = g.game.joinedPlayerIds.indexOf(g.game.selfId) !== -1;
		g.game.pushScene(new GameScene({
			game: g.game,
			assetIds,
			isCpuMode: true,
			cpuReserved: reserved,
			service: {
				mode: "ring",
				random: g.game.localRandom,
				players: [
					{
						id: g.game.selfId,
						name: "プレイヤー",
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

	private createButtonEntity(params: {
		x: number;
		y: number;
		width: number;
		height: number;
		label: string;
		fontSize: number;
		baseColor: string;
		textColor: string;
	}): { entity: g.E; rect: g.FilledRect; label: Label; shine: g.FilledRect } {
		const entity = new g.E({
			scene: this,
			x: params.x,
			y: params.y,
			width: params.width,
			height: params.height,
			local: true,
			touchable: true
		});
		const shadow = new g.FilledRect({
			scene: this,
			cssColor: COLOR_PANEL_SHADOW,
			width: params.width,
			height: params.height,
			x: 0,
			y: 4,
			opacity: 0.7
		});
		entity.append(shadow);
		const rect = new g.FilledRect({
			scene: this,
			cssColor: params.baseColor,
			width: params.width,
			height: params.height,
			opacity: 0.95
		});
		entity.append(rect);
		const shine = new g.FilledRect({
			scene: this,
			cssColor: "white",
			width: params.width,
			height: 0.25 * params.height,
			opacity: 0.22
		});
		entity.append(shine);
		const label = new Label({
			scene: this,
			text: params.label,
			font: basicFont,
			fontSize: params.fontSize,
			textColor: params.textColor,
			textAlign: "center",
			width: params.width,
			y: 0.2 * params.height,
			local: true
		});
		entity.append(label);
		return { entity, rect, label, shine };
	}
}
